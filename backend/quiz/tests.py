from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Question, Option, Group, QuizSession, QuizResult
import uuid

User = get_user_model()


class UserModelTest(TestCase):
    """ユーザーモデルのテスト"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            display_name='Test User'
        )
    
    def test_user_creation(self):
        """ユーザー作成テスト"""
        self.assertEqual(self.user.email, 'test@example.com')
        self.assertEqual(self.user.display_name, 'Test User')
        self.assertFalse(self.user.is_staff)
    
    def test_user_str(self):
        """ユーザー文字列表現テスト"""
        self.assertEqual(str(self.user), 'test@example.com')


class QuestionModelTest(TestCase):
    """問題モデルのテスト"""
    
    def setUp(self):
        self.question = Question.objects.create(
            text='apple',
            level='basic',
            segment='A'
        )
        self.correct_option = Option.objects.create(
            question=self.question,
            text='りんご',
            is_correct=True
        )
        self.wrong_option = Option.objects.create(
            question=self.question,
            text='みかん',
            is_correct=False
        )
    
    def test_question_creation(self):
        """問題作成テスト"""
        self.assertEqual(self.question.text, 'apple')
        self.assertEqual(self.question.level, 'basic')
        self.assertEqual(self.question.segment, 'A')
    
    def test_question_options(self):
        """問題の選択肢テスト"""
        options = self.question.options.all()
        self.assertEqual(options.count(), 2)
        correct_options = options.filter(is_correct=True)
        self.assertEqual(correct_options.count(), 1)
        self.assertEqual(correct_options.first().text, 'りんご')


class QuestionAPITest(APITestCase):
    """問題API のテスト"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
        self.question = Question.objects.create(
            text='apple',
            level='basic',
            segment='A'
        )
        Option.objects.create(
            question=self.question,
            text='りんご',
            is_correct=True
        )
        Option.objects.create(
            question=self.question,
            text='みかん',
            is_correct=False
        )
    
    def test_question_list_unauthorized(self):
        """認証なしでの問題一覧取得テスト"""
        url = reverse('question-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_question_list_authorized(self):
        """認証ありでの問題一覧取得テスト"""
        self.client.force_authenticate(user=self.user)
        url = reverse('question-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['text'], 'apple')
        self.assertEqual(len(response.data['results'][0]['options']), 2)
    
    def test_question_list_with_filters(self):
        """フィルター付き問題一覧取得テスト"""
        # 別レベルの問題を追加
        Question.objects.create(text='book', level='intermediate', segment='B')
        
        self.client.force_authenticate(user=self.user)
        url = reverse('question-list')
        
        # レベルフィルター
        response = self.client.get(url, {'level': 'basic'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        
        # セグメントフィルター
        response = self.client.get(url, {'segment': 'A'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)


class QuizSessionAPITest(APITestCase):
    """クイズセッションAPIのテスト"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
        self.question = Question.objects.create(
            text='apple',
            level='basic',
            segment='A'
        )
        self.correct_option = Option.objects.create(
            question=self.question,
            text='りんご',
            is_correct=True
        )
        self.wrong_option = Option.objects.create(
            question=self.question,
            text='みかん',
            is_correct=False
        )
    
    def test_session_creation(self):
        """セッション作成テスト"""
        self.client.force_authenticate(user=self.user)
        url = reverse('quizsession-list')
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(QuizSession.objects.count(), 1)
        session = QuizSession.objects.first()
        self.assertEqual(session.user, self.user)
        self.assertIsNotNone(session.started_at)
        self.assertIsNone(session.completed_at)
    
    def test_submit_answer(self):
        """回答送信テスト"""
        self.client.force_authenticate(user=self.user)
        
        # セッション作成
        session = QuizSession.objects.create(user=self.user)
        
        # 正解送信
        url = reverse('quizsession-answers', kwargs={'pk': session.id})
        data = {
            'question_id': str(self.question.id),
            'chosen_option_id': str(self.correct_option.id),
            'elapsed_ms': 3000
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_correct'])
        
        # 結果確認
        self.assertEqual(QuizResult.objects.count(), 1)
        result = QuizResult.objects.first()
        self.assertEqual(result.session, session)
        self.assertEqual(result.question, self.question)
        self.assertEqual(result.chosen_option, self.correct_option)
        self.assertTrue(result.is_correct)
        self.assertEqual(result.elapsed_ms, 3000)
    
    def test_complete_session(self):
        """セッション完了テスト"""
        self.client.force_authenticate(user=self.user)
        
        # セッション作成
        session = QuizSession.objects.create(user=self.user)
        
        # セッション完了
        url = reverse('quizsession-complete', kwargs={'pk': session.id})
        data = {'total_time_ms': 30000}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'completed')
        
        # セッション確認
        session.refresh_from_db()
        self.assertIsNotNone(session.completed_at)
        self.assertEqual(session.total_time_ms, 30000)


class CurrentUserAPITest(APITestCase):
    """現在のユーザーAPIのテスト"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            display_name='Test User'
        )
    
    def test_current_user_unauthorized(self):
        """認証なしでの現在ユーザー取得テスト"""
        url = reverse('current-user')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_current_user_authorized(self):
        """認証ありでの現在ユーザー取得テスト"""
        self.client.force_authenticate(user=self.user)
        url = reverse('current-user')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'test@example.com')
        self.assertEqual(response.data['display_name'], 'Test User')


class AdminAPITest(APITestCase):
    """管理者APIのテスト"""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            is_staff=True
        )
        self.regular_user = User.objects.create_user(
            username='user',
            email='user@example.com'
        )
    
    def test_admin_users_list_as_admin(self):
        """管理者としてのユーザー一覧取得テスト"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin-users')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
    
    def test_admin_users_list_as_regular_user(self):
        """一般ユーザーとしてのユーザー一覧取得テスト"""
        self.client.force_authenticate(user=self.regular_user)
        url = reverse('admin-users')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
