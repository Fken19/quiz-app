import sys
from unittest.mock import MagicMock
import pytest
from app import create_app

# Firestore 無効化（モック）
sys.modules['firestore_client'] = MagicMock()

# Flaskのテストクライアント用fixture
@pytest.fixture
def client():
    app = create_app()
    return app.test_client()

# 共通セッション設定ヘルパー
def login_session(client):
    with client.session_transaction() as sess:
        sess["user_email"] = "test@example.com"
        sess["user_name"] = "Test User"
        sess["user_picture"] = "https://example.com/pic.png"

# ルートページの正常表示確認
def test_home_page(client):
    response = client.get('/')
    assert response.status_code == 200

# ログインが必要なページのリダイレクト確認（未ログイン時）
@pytest.mark.parametrize("url", ["/level-selection", "/quiz/1", "/dashboard", "/segments/1"])
def test_requires_login(client, url):
    response = client.get(url)
    assert response.status_code in [302, 401]

# ログイン済みページアクセス成功確認
@pytest.mark.parametrize("url", ["/quiz/1", "/dashboard", "/segments/1"])
def test_authenticated_pages(client, url):
    login_session(client)
    if url == "/dashboard":
        mock_db = MagicMock()
        mock_collection = mock_db.collection.return_value
        mock_collection.where.return_value.order_by.return_value.get.return_value = []
        client.application.db = mock_db
    response = client.get(url)
    assert response.status_code == 200

def test_submit_quiz_result(client):
    login_session(client)

    mock_db = MagicMock()
    mock_collection = mock_db.collection.return_value
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "fake_id"
    mock_collection.add.return_value = (mock_doc_ref, {})
    client.application.db = mock_db

    mock_firestore = MagicMock()
    mock_firestore.SERVER_TIMESTAMP = "MOCKED_TIMESTAMP"
    client.application.firestore = mock_firestore

    response = client.post('/submit', json={
        "score": 8,
        "total": 10,
        "total_time": 45.3
    })
    assert response.status_code == 200
    assert b"success" in response.data or b"result_id" in response.data
    mock_db.collection.assert_called_with("quiz_results")
    mock_db.collection().add.assert_called()

def test_results_authenticated(client, monkeypatch):
    # モックユーザーセッションをセット
    with client.session_transaction() as sess:
        sess['user_email'] = 'test@example.com'
        sess['user_name'] = 'Test User'
        sess['user_picture'] = 'https://example.com/image.jpg'

    # Firestore のモック
    class MockDoc:
        def __init__(self, id):
            self.id = id
        def to_dict(self):
            return {
                "user_email": "test@example.com",
                "score": 8,
                "total": 10,
                "total_time": 5.5,
                "created_at": datetime.utcnow()
            }
        @property
        def exists(self):
            return True

    class MockCollection:
        def where(self, *args, **kwargs):
            return self
        def stream(self):
            return [MockDoc("result1")]

    monkeypatch.setattr("app.app.db", type("MockDB", (), {
        "collection": lambda self, name: MockCollection()
    })())

    response = client.get('/results')
    assert response.status_code == 200
    assert b"結果" in response.data  # "結果" などがHTML内にあるか検証

    def test_login_redirect(client):
    response = client.get('/login')
    assert response.status_code in [302, 401, 200]  # Google認証リダイレクトを許容

def test_logout_clears_session(client):
    # まず仮のログイン状態にする
    with client.session_transaction() as sess:
        sess['user_email'] = 'test@example.com'

    # ログアウトリクエストを送る
    response = client.get('/logout')

    # セッションが空になったことを確認
    with client.session_transaction() as sess_after:
        assert 'user_email' not in sess_after