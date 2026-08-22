#!/usr/bin/env bash

# Spotify Smart Controller & Tag Manager Startup Script

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "🎵 Starting Spotify Smart Controller..."

# Create Python virtual environment if not already present
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install / update requirements
echo "📥 Checking dependencies..."
pip install -q -r requirements.txt

# Create .env if missing
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Detect Local Mac IP for Android Access
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo ""
echo "======================================================="
echo "🚀 Kiki's Spotify Mixer is running!"
echo ""
echo "   💻 On Mac:      http://localhost:8888"
echo "   📱 On Android:  http://${LOCAL_IP}:8888"
echo "======================================================="
echo ""

# Launch uvicorn server
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8888 --reload
