.PHONY: run dev test

run:
	uv run uvicorn freezewise.main:app --host 0.0.0.0 --port 8892

dev:
	uv run uvicorn freezewise.main:app --host 0.0.0.0 --port 8892 --reload

test:
	uv run pytest tests/ -v
