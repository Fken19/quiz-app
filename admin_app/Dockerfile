# admin_app/Dockerfile

FROM python:3.10-slim

WORKDIR /app

# 共通の requirements.txt をルートからコピー
COPY ../requirements.txt /app/requirements.txt
COPY ../ /app

RUN pip install --no-cache-dir -r requirements.txt

ENV PORT=8080

CMD ["gunicorn", "-b", "0.0.0.0:8080", "admin_app.admin_app:app"]