"""Exercise the real fridge component and persisted store on the isolated stand."""

import argparse
import copy
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

OUT = None
PRODUCT = {
    "id": 700001,
    "name": "QA batch soup",
    "name_ru": "QA суп",
    "name_cn": "QA 汤",
    "category": "prepared",
    "can_freeze": True,
    "freeze_months": 3,
    "freeze_how": "Synthetic instruction",
    "thaw_how": "Synthetic instruction",
    "fridge_days": 30,
    "pantry_days": 0,
    "spoilage_signs": "Synthetic fixture",
    "tips": [],
    "icon": "🥣",
}
ITEM = {
    "id": "qa-quantity-primary",
    "product": PRODUCT,
    "location": "fridge",
    "quantity": "4 portions",
    "notes": "Keep this synthetic note",
    "addedAt": "",  # Assigned once per run, then preserved through every edit/reload.
}
OTHER = {
    **copy.deepcopy(ITEM),
    "id": "qa-quantity-other",
    "quantity": "half a bag",
    "product": {**PRODUCT, "id": 700002, "name": "QA other item"},
}


def stored(page):
    return page.evaluate("""() => ({
      items: JSON.parse(localStorage.getItem('freezewise-fridge')),
      history: localStorage.getItem('freezewise-history')
    })""")


def assert_update(before, after, quantity):
    expected = copy.deepcopy(before)
    expected["items"][0]["quantity"] = quantity
    assert after == expected, "Quantity edit changed unrelated persisted fields/history"


def regression(page, result):
    expect(
        page.get_by_role("heading", name="QA batch soup", exact=True)
    ).to_be_visible()
    expect(
        page.get_by_role("heading", name="QA other item", exact=True)
    ).to_be_visible()
    before = stored(page)
    assert before["items"] == [ITEM, OTHER], "Synthetic store failed to hydrate"
    result["fixture_hydrated"] = True
    result["phase"] = "quantity_affordance"
    page.screenshot(path=str(OUT / f"{result['label']}-before-390.png"), full_page=True)
    edit = page.get_by_role("button", name=re.compile("edit quantity", re.I)).first
    expect(edit).to_be_visible(timeout=5000)
    edit.click()
    field = page.get_by_role("textbox", name=re.compile("quantity", re.I))
    expect(field).to_have_value("4 portions")
    field.fill("  3 portions  ")
    page.get_by_role("button", name=re.compile("^save$", re.I)).click()
    expect(field).to_have_count(0)
    assert_update(before, stored(page), "3 portions")
    page.reload(wait_until="domcontentloaded")
    expect(
        page.get_by_role("heading", name="QA batch soup", exact=True)
    ).to_be_visible()
    assert_update(before, stored(page), "3 portions")
    result["saved_and_reloaded"] = True
    result["phase"] = "cancel_and_invalid"
    checkpoint = stored(page)
    edit.click()
    field.fill("discard this edit")
    page.get_by_role("button", name=re.compile("^cancel$", re.I)).click()
    assert stored(page) == checkpoint, "Cancel mutated persisted state"
    edit.click()
    field.fill("   ")
    page.get_by_role("button", name=re.compile("^save$", re.I)).click()
    expect(field).to_be_visible()
    assert stored(page) == checkpoint, "Whitespace-only input mutated persisted state"
    assert (
        page.get_by_role("alert").count() > 0
        or field.get_attribute("aria-invalid") == "true"
    ), "Invalid quantity has no accessible feedback"
    field.fill("half a bag")
    field.press("Enter")
    expect(field).to_have_count(0)
    assert_update(before, stored(page), "half a bag")
    result["cancel_invalid_repeated_text_units"] = True
    result["phase"] = "complete"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:34317")
    parser.add_argument("--label", choices=["red", "green"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    global OUT
    OUT = args.output.resolve()
    OUT.mkdir(parents=True, exist_ok=True)
    fixture_date = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    ITEM["addedAt"] = fixture_date
    OTHER["addedAt"] = fixture_date
    assert urlsplit(args.base).hostname == "127.0.0.1", "Loopback stand required"
    result = {
        "label": args.label,
        "passed": False,
        "fixture_hydrated": False,
        "phase": "browser_start",
        "blocked_requests": [],
        "browser_closed": False,
    }
    browser = context = None
    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                record_video_dir=str(OUT / (args.label + "-video")),
            )

            def route(request_route):
                request = request_route.request
                url = urlsplit(request.url)
                if (
                    url.hostname != "127.0.0.1"
                    or url.path.startswith("/api/")
                    or request.method not in ["GET", "HEAD"]
                ):
                    result["blocked_requests"].append(
                        {"type": request.resource_type, "method": request.method}
                    )
                    request_route.abort()
                else:
                    request_route.continue_()

            context.route("**/*", route)
            context.add_init_script(
                script="""if (!localStorage.getItem('freezewise-fridge')) {
                localStorage.setItem('freezewise-fridge', JSON.stringify(%s));
                localStorage.setItem('freezewise-history', '[]');
            } localStorage.setItem('freezewise-locale', 'en');"""
                % json.dumps([ITEM, OTHER])
            )
            page = context.new_page()
            result["phase"] = "navigation"
            response = page.goto(
                args.base + "/fridge", wait_until="domcontentloaded", timeout=60000
            )
            assert response and response.status == 200, (
                "Stand response was not HTTP 200"
            )
            result["http_status"] = response.status
            regression(page, result)
            result["passed"] = True
        except Exception as error:
            result["error_class"] = type(error).__name__
            result["failure"] = (
                str(error)[:1000]
                if result["fixture_hydrated"]
                else "Stand/browser/readiness failure; not a functional RED"
            )
        finally:
            if context:
                context.close()
            if browser:
                browser.close()
            result["browser_closed"] = True
            (OUT / (args.label + "-receipt.json")).write_text(
                json.dumps(result, indent=2) + "\n"
            )
    print(json.dumps(result))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
