# extensions.py
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from google.cloud import storage

storage_client = storage.Client()
