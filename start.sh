#!/bin/bash
# Start regulatory-dashboard-danAI (v2)
# Backend runs on 5124, frontend on 3001 to avoid collision with v1

echo "Starting Regulatory Dashboard v2 - DanAI Edition"
echo "Backend  → http://localhost:5124"
echo "Frontend → http://localhost:3001"
echo ""

# Backend
cd "$(dirname "$0")/backend"
if [ ! -d "venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
python app.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Frontend
cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "Running npm install (first time setup)..."
  npm install
fi
export PORT=3001
npm start &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "Both services started. Press Ctrl+C to stop."
wait
