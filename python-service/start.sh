#!/usr/bin/env bash
# Start the AralSync AI microservice
cd "$(dirname "$0")"
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
