import apiClient from '@/lib/api';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture?: string;
  score: number;
  is_admin: boolean;
  date_joined: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  questions_count: number;
  time_limit: number;
  pass_score: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  difficulty: number;
  order: number;
}

export interface QuizSession {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  max_score: number;
  start_time: string;
  end_time?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface Answer {
  id: string;
  session_id: string;
  question_id: string;
  selected_answer: 'A' | 'B' | 'C' | 'D';
  is_correct: boolean;
  answered_at: string;
}

export interface DashboardStats {
  total_quizzes: number;
  completed_sessions: number;
  average_score: number;
  recent_sessions: QuizSession[];
}

// Auth API
export const authAPI = {
  async login(credentials: { email: string; password: string }) {
    const response = await apiClient.post('/auth/login/', credentials);
    return response.data;
  },

  async register(data: { email: string; password: string; first_name: string; last_name: string }) {
    const response = await apiClient.post('/auth/register/', data);
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout/');
    return response.data;
  },

  async getProfile() {
    const response = await apiClient.get('/auth/profile/');
    return response.data as User;
  },

  async updateProfile(data: Partial<User>) {
    const response = await apiClient.patch('/auth/profile/', data);
    return response.data as User;
  },
};

// Dashboard API
export const dashboardAPI = {
  async getStats(): Promise<DashboardStats> {
    const response = await apiClient.get('/api/dashboard/stats/');
    return response.data;
  },

  async getRecentSessions(): Promise<QuizSession[]> {
    const response = await apiClient.get('/api/dashboard/recent-sessions/');
    return response.data;
  },
};

// Quiz API
export const quizAPI = {
  async getQuizzes(): Promise<Quiz[]> {
    const response = await apiClient.get('/api/quizzes/');
    return response.data;
  },

  async getQuiz(id: string): Promise<Quiz> {
    const response = await apiClient.get(`/api/quizzes/${id}/`);
    return response.data;
  },

  async getQuestions(quizId: string): Promise<Question[]> {
    const response = await apiClient.get(`/api/quizzes/${quizId}/questions/`);
    return response.data;
  },

  async startSession(quizId: string): Promise<QuizSession> {
    const response = await apiClient.post(`/api/quizzes/${quizId}/start/`);
    return response.data;
  },

  async submitAnswer(sessionId: string, questionId: string, answer: 'A' | 'B' | 'C' | 'D'): Promise<Answer> {
    const response = await apiClient.post(`/api/sessions/${sessionId}/answers/`, {
      question_id: questionId,
      selected_answer: answer,
    });
    return response.data;
  },

  async endSession(sessionId: string): Promise<QuizSession> {
    const response = await apiClient.post(`/api/sessions/${sessionId}/end/`);
    return response.data;
  },

  async getSession(sessionId: string): Promise<QuizSession> {
    const response = await apiClient.get(`/api/sessions/${sessionId}/`);
    return response.data;
  },

  async getSessionAnswers(sessionId: string): Promise<Answer[]> {
    const response = await apiClient.get(`/api/sessions/${sessionId}/answers/`);
    return response.data;
  },
};
