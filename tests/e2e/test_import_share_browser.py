"""Real /fridge import and stale-response regression; synthetic API only."""

import argparse
import json
import subprocess
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit

from playwright.sync_api import expect, sync_playwright

ITEM = {"n": "QA soup", "c": "prepared", "i": "🥣", "l": "freezer", "q": "half a bag"}
PRODUCT = {
    "id": 800001,
    "name": "QA soup",
    "name_ru": "QA суп",
    "name_cn": "QA 汤",
    "category": "prepared",
    "icon": "🥣",
    "fridge_days": 30,
    "freeze_months": 3,
    "pantry_days": 0,
    "can_freeze": True,
}


def encode(value, node):
    frontend = Path(__file__).resolve().parents[2] / "frontend"
    return subprocess.check_output(
        [
            node,
            "-e",
            "process.stdout.write(require('lz-string').compressToEncodedURIComponent(process.argv[1]))",
            json.dumps(value),
        ],
        cwd=frontend,
        text=True,
    )


def title(page):
    return page.get_by_role("heading", name="Import Fridge", exact=True)


def navigate(page, value=None):
    suffix = "" if value is None else "?share=" + quote(value, safe="")
    page.evaluate("url => window.history.pushState(null, '', url)", "/fridge" + suffix)


def stored(page):
    return page.evaluate("""() => ({
      items: JSON.parse(localStorage.getItem('freezewise-fridge') || '[]'),
      history: localStorage.getItem('freezewise-history')
    })""")


def install_routes(context, state, result):
    def route(request_route):
        req = request_route.request
        url = urlsplit(req.url)
        if url.hostname != "127.0.0.1" or req.method not in ["GET", "HEAD"]:
            request_route.abort()
        elif url.path == "/api/products/search":
            query = parse_qs(url.query).get("q", [None])[0]
            result["requests"].append(query)
            assert query and query != "undefined", "Invalid name reached product search"
            if state["mode"] == "hold":
                state["held"].append(request_route)
            elif state["mode"] == "empty":
                request_route.fulfill(json={"products": [], "source": "synthetic"})
            elif state["mode"] == "failure" or query == "QA failed":
                request_route.fulfill(status=503, json={"error": "synthetic failure"})
            else:
                request_route.fulfill(
                    json={"products": [PRODUCT], "source": "synthetic"}
                )
        elif url.path.startswith("/api/"):
            request_route.abort()
        else:
            request_route.continue_()

    context.route("**/*", route)
    context.add_init_script("localStorage.setItem('freezewise-locale', 'en')")


def new_page(browser, state, result, base):
    context = browser.new_context(viewport={"width": 390, "height": 844})
    install_routes(context, state, result)
    page = context.new_page()
    page.on("pageerror", lambda error: result["page_errors"].append(str(error)))
    response = page.goto(base + "/fridge", wait_until="networkidle")
    assert response.status == 200
    return context, page


def malformed_scenario(page, args, result):
    invalid = [
        "",
        "malformed",
        [],
        None,
        {},
        [None],
        [{}],
        [{**ITEM, "n": None}],
        [{**ITEM, "c": None}],
        [{**ITEM, "i": {}}],
        [{**ITEM, "q": 3}],
        [{**ITEM, "l": "unknown"}],
        [{**ITEM, "n": "   "}],
        [ITEM, None],
    ]
    for index, value in enumerate(invalid):
        navigate(page, value if index < 2 else encode(value, args.node))
        expect(title(page)).to_have_count(0)
    assert result["requests"] == []
    result["passed"].append("malformed_empty_null_object_wrong_shape_no_search")


def navigation_scenario(page, fixtures, args, result):
    navigate(page, fixtures["a"])
    expect(title(page)).to_be_visible()
    expect(page.get_by_text("QA soup", exact=True)).to_be_visible()
    navigate(page, fixtures["b"])
    expect(page.get_by_text("QA second", exact=True)).to_be_visible()
    expect(page.get_by_text("QA soup", exact=True)).to_have_count(0)
    navigate(page)
    expect(title(page)).to_have_count(0)
    navigate(page, fixtures["a"])
    expect(title(page)).to_be_visible()
    page.get_by_role("button", name="Close", exact=True).click()
    expect(title(page)).to_have_count(0)
    expect(page).to_have_url(args.base + "/fridge")
    navigate(page, fixtures["a"])
    expect(title(page)).to_be_visible()
    result["passed"].append("changed_query_removed_query_close_same_query_reopen")


def import_and_close(page, count, base):
    page.get_by_role("button", name=f"Import {count} items", exact=True).click()
    expect(title(page)).to_have_count(0)
    expect(page).to_have_url(base + "/fridge")


def imports_scenario(page, state, args, result):
    import_and_close(page, 1, args.base)
    assert stored(page)["items"][0]["quantity"] == "half a bag"
    assert stored(page)["items"][0]["location"] == "freezer"
    expect(page.get_by_text("1 / 1 items imported", exact=True)).to_be_visible()
    result["passed"].append("successful_import_text_quantity_location_toast")
    before = stored(page)
    state["mode"] = "failure"
    navigate(page, encode([ITEM], args.node))
    import_and_close(page, 1, args.base)
    assert stored(page) == before
    expect(page.get_by_text("0 / 1 items imported", exact=True)).to_be_visible()
    result["passed"].append("failed_import_preserves_inventory_and_closes")
    state["mode"] = "empty"
    navigate(page, encode([ITEM], args.node))
    import_and_close(page, 1, args.base)
    assert stored(page) == before
    expect(page.get_by_text("0 / 1 items imported", exact=True)).to_be_visible()
    result["passed"].append("empty_result_preserves_inventory_and_closes")
    state["mode"] = "success"
    navigate(page, encode([ITEM, {**ITEM, "n": "QA failed"}], args.node))
    import_and_close(page, 2, args.base)
    assert len(stored(page)["items"]) == len(before["items"]) + 1
    expect(page.get_by_text("1 / 2 items imported", exact=True)).to_be_visible()
    result["passed"].append("partial_import_count_and_close")


def hold_import(page, state, fixtures):
    navigate(page, fixtures["pending"])
    expect(title(page)).to_be_visible()
    expect(page.get_by_text("QA soup", exact=True)).to_be_visible()
    with page.expect_request(
        lambda req: urlsplit(req.url).path == "/api/products/search"
    ):
        page.get_by_role("button", name="Import 2 items", exact=True).click()
    expect(page.get_by_role("button", name="Importing...", exact=True)).to_be_disabled()
    assert len(state["held"]) == 1, "Synthetic response was not held"


def obsolete_dialog(page, action, fixtures, base):
    if action == "query_change":
        navigate(page, fixtures["b"])
        expect(page.get_by_text("QA second", exact=True)).to_be_visible()
        expect(page.get_by_text("QA soup", exact=True)).to_have_count(0)
    else:
        page.get_by_role("button", name="Close", exact=True).click()
        expect(title(page)).to_have_count(0)
        expect(page).to_have_url(base + "/fridge")


def release_response(page, held, rejected):
    with page.expect_response(
        lambda response: urlsplit(response.url).path == "/api/products/search"
    ) as completion:
        if rejected:
            held.fulfill(status=503, json={"error": "synthetic failure"})
        else:
            held.fulfill(
                status=200, json={"products": [PRODUCT], "source": "synthetic"}
            )
    assert completion.value.finished() is None, "Synthetic response body did not finish"
    page.evaluate(
        "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
    )


def assert_stale_ignored(page, before, expected_url, action, result):
    assert stored(page) == before, "Stale response changed inventory/history"
    assert page.url == expected_url, "Stale response replaced current query"
    assert len(result["requests"]) == 1, "Stale failure continued next-item search"
    expect(page.get_by_text("0 / 2 items imported", exact=True)).to_have_count(0)
    expect(page.get_by_text("1 / 2 items imported", exact=True)).to_have_count(0)
    expect(page.get_by_text("2 / 2 items imported", exact=True)).to_have_count(0)
    if action == "query_change":
        expect(title(page)).to_be_visible()
        expect(page.get_by_text("QA second", exact=True)).to_be_visible()
    else:
        expect(title(page)).to_have_count(0)


def race_scenario(browser, args, fixtures, case):
    action, rejected = case
    result = {"requests": [], "page_errors": []}
    state = {"mode": "hold", "held": []}
    context, page = new_page(browser, state, result, args.base)
    try:
        hold_import(page, state, fixtures)
        obsolete_dialog(page, action, fixtures, args.base)
        expected_url, before = page.url, stored(page)
        assert before["items"] == [], "Fresh synthetic inventory was not empty"
        release_response(page, state["held"][0], rejected)
        assert_stale_ignored(page, before, expected_url, action, result)
        state["mode"] = "success"
        if action == "close_pending":
            navigate(page, fixtures["pending"])
            expect(title(page)).to_be_visible()
            import_and_close(page, 2, args.base)
            assert len(stored(page)["items"]) == 2
        else:
            import_and_close(page, 1, args.base)
            assert len(stored(page)["items"]) == 1
        assert result["page_errors"] == []
        return {
            "action": action,
            "rejected": rejected,
            "response_finished": True,
            "passed": True,
            "new_or_reopened_dialog_functional": True,
        }
    finally:
        context.close()


def ordinary_scenarios(browser, args, fixtures, result):
    state = {"mode": "success", "held": []}
    context, page = new_page(browser, state, result, args.base)
    try:
        malformed_scenario(page, args, result)
        navigation_scenario(page, fixtures, args, result)
        imports_scenario(page, state, args, result)
        assert result["page_errors"] == []
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    assert urlsplit(args.base).hostname == "127.0.0.1", "Loopback stand required"
    args.output.mkdir(parents=True, exist_ok=True)
    fixtures = {
        "a": encode([ITEM], args.node),
        "b": encode([{**ITEM, "n": "QA second"}], args.node),
        "pending": encode([ITEM, {**ITEM, "n": "QA followup"}], args.node),
    }
    result = {"passed": [], "requests": [], "page_errors": [], "browser_closed": False}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            ordinary_scenarios(browser, args, fixtures, result)
            result["races"] = [
                race_scenario(browser, args, fixtures, (action, rejected))
                for action in ["query_change", "close_pending"]
                for rejected in [False, True]
            ]
            result["success"] = True
        finally:
            browser.close()
            result["browser_closed"] = True
            (args.output / "import-share-receipt.json").write_text(
                json.dumps(result, indent=2) + "\n"
            )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
