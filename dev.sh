#!/bin/bash
# Local development script — runs backend + frontend without Docker
# Usage: ./dev.sh

set -e

echo "🚀 Starting CodeStudio development servers..."
echo ""

# Check if backend venv exists
if [ ! -d "backend/.venv" ]; then
  echo "📦 Creating backend virtual environment..."
  cd backend
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  cd ..
else
  echo "✅ Backend venv found"
fi

# Check if frontend node_modules exists
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend && npm install && cd ..
else
  echo "✅ Frontend node_modules found"
fi

echo ""
echo "Starting services..."
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""

# Start backend in background
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Start frontend in background
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Handle Ctrl+C — kill both processes
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for either to exit
wait
