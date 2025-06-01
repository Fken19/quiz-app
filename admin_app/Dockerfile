# admin_app/Dockerfile
FROM python:3.10-slim
WORKDIR /app

COPY admin_requirements.txt /app/admin_requirements.txt
COPY . /app
COPY english_firestore_key.json /app/english_firestore_key.json

RUN pip install --no-cache-dir -r admin_requirements.txt

ENV PORT=8080
CMD ["gunicorn", "-b", "0.0.0.0:8080", "admin_app.admin_app:app"]