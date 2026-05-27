#!/bin/bash
# Run the full stack (backend + frontend) locally
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Sargazo Cozumel — Local Dev ==="

# Activate venv
source venv/bin/activate

# Start backend in background
echo "Starting backend on :8001..."
cd backend
python -m uvicorn app:app --host 0.0.0.0 --port 8001 --reload --reload-dir . &
BACKEND_PID=$!
cd ..

# Start frontend
echo "Starting frontend on :5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Backend:  http://localhost:8001"
echo "Frontend: http://localhost:5173"
echo "API docs: http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
