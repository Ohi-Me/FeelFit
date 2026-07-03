FROM python:3.11-slim
# tesseract-ocr: OCR fallback for scanned PDFs
# curl: required by docker-compose healthcheck (`curl -f /api/health`)
# libgl1-mesa-glx, libglib2.0-0, libsm6, libxext6: OpenCV runtime deps for PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng \
    curl \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# Shell form so $PORT (injected by Render/Railway/Fly) is honoured; falls back to 8000.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
