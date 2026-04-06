#!/bin/bash
# FreezeWise — start FastAPI backend + Next.js frontend

cd "$(dirname "$0")"

# Backend on internal port 8892
uv run uvicorn freezewise.main:app --host 0.0.0.0 --port 8892 &
BACKEND_PID=$!

# Frontend on port 3000 (proxies /api/* to backend)
cd frontend
if [ -d ".next" ]; then
    # Production mode
    npx next start -p 3000 &
else
    # Development mode
    npm run dev -- -p 3000 &
fi
FRONTEND_PID=$!

echo "FreezeWise started:"
echo "  Backend:  http://localhost:8892"
echo "  Frontend: http://localhost:3000"

wait $BACKEND_PID $FRONTEND_PID
