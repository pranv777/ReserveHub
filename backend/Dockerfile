# syntax=docker/dockerfile:1
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PORT=8000
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY migrations ./migrations
RUN useradd -r -u 1001 appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s/api/v1/health/live' % os.environ.get('PORT','8000'))" || exit 1
# Migrations are an explicit step (compose `migrate` service / scripts/migrate_sql.sh / alembic upgrade head), not run at boot.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
