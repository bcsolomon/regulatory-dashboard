#!/bin/bash

echo "🚀 Starting Interactive Regulatory Dashboard..."
echo ""

# Check if in correct directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Run this script from the regulatory-dashboard-app directory"
    exit 1
fi

# Start backend in background
echo "📡 Starting Flask backend..."
cd backend
python3 -m venv venv 2>/dev/null
source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1
python app.py &
BACKEND_PID=$!
echo "✅ Backend running on http://localhost:5123 (PID: $BACKEND_PID)"
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Start frontend
echo "⚛️  Starting React frontend..."
cd frontend
npm install > /dev/null 2>&1
npm start &
FRONTEND_PID=$!
echo "✅ Frontend running on http://localhost:3000 (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "🎉 Dashboard is starting!"
echo ""
echo "📊 Open your browser to: http://localhost:3000"
echo ""
echo "To stop:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
wait
