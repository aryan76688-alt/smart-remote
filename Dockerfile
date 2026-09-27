# ── Stage 1: Build frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime ─────────────────────────────────────
FROM python:3.11-slim

# System deps for psycopg2 (binary wheel), and cleanup
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy pre-built frontend from Stage 1
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Copy APK into static paths so it's downloadable
COPY backend/static/SmartRemote.apk ./frontend/dist/SmartRemote.apk

# Railway injects PORT env var; uvicorn reads it
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

EXPOSE 7070

CMD ["sh", "-c", "cd /app/backend && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7070}"]
