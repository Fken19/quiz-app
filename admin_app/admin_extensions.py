# extensions.py
from google.cloud import firestore

db = firestore.Client()

from google.cloud import storage

storage_client = storage.Client()
