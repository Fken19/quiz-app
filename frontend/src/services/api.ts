import apiClient from '@/lib/api';
import { 
  User, 
  Word, 
  QuizSet, 
  QuizItem, 
  QuizResponse, 
  QuizResult,
  WordTranslation 
} from '@/types/quiz';

// ダッシュボード統計
export interface DashboardStats {
  total_quizzes: number;
  completed_quizzes: number;
  average_score: number;
  total_words_learned: number;
  recent_results: QuizResult[];
  level_progress: {
    level: number;
    completed: number;
    total: number;
  }[];
}

// クイズ設定
export interface QuizConfig {
  mode: 'default' | 'random';
  level: number;
  segment: number;
  question_count: number;
}

// Auth API
export const authAPI = {
  async login(credentials: { email: string; password: string }) {
    const response = await apiClient.post('/auth/login/', credentials);
    return response;
  },

  async register(data: { email: string; password: string; display_name: string }) {
    const response = await apiClient.post('/auth/register/', data);
    return response;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout/');
    return response;
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get('/auth/profile/');
    return response;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.post('/auth/profile/', data);
    return response;
  },
};

// Dashboard API
export const dashboardAPI = {
  async getStats(): Promise<DashboardStats> {
    const response = await apiClient.get('/api/dashboard/stats/');
    return response;
  },

  async getRecentResults(): Promise<QuizResult[]> {
    const response = await apiClient.get('/api/dashboard/recent-results/');
    return response;
  },
};

// Word API
export const wordAPI = {
  async getWords(level: number, segment: number): Promise<Word[]> {
    const response = await apiClient.get(`/api/words/?level=${level}&segment=${segment}`);
    return response;
  },

  async getWord(id: string): Promise<Word> {
    const response = await apiClient.get(`/api/words/${id}/`);
    return response;
  },

  async getTranslations(wordId: string): Promise<WordTranslation[]> {
    const response = await apiClient.get(`/api/words/${wordId}/translations/`);
    return response;
  },
};

// Quiz API
export const quizAPI = {
  async createQuizSet(config: QuizConfig): Promise<QuizSet> {
    const response = await apiClient.post('/api/quiz-sets/', config);
    return response;
  },

  async getQuizSet(id: string): Promise<QuizSet> {
    const response = await apiClient.get(`/api/quiz-sets/${id}/`);
    return response;
  },

  async getQuizItems(quizSetId: string): Promise<QuizItem[]> {
    const response = await apiClient.get(`/api/quiz-sets/${quizSetId}/items/`);
    return response;
  },

  async startQuiz(quizSetId: string): Promise<QuizSet> {
    const response = await apiClient.post(`/api/quiz-sets/${quizSetId}/start/`);
    return response;
  },

  async submitAnswer(quizSetId: string, itemId: string, selectedTranslationId: string): Promise<QuizResponse> {
    const response = await apiClient.post(`/api/quiz-sets/${quizSetId}/responses/`, {
      quiz_item_id: itemId,
      selected_translation_id: selectedTranslationId,
    });
    return response;
  },

  async finishQuiz(quizSetId: string): Promise<QuizResult> {
    const response = await apiClient.post(`/api/quiz-sets/${quizSetId}/finish/`);
    return response;
  },

  async getQuizResult(quizSetId: string): Promise<QuizResult> {
    const response = await apiClient.get(`/api/quiz-sets/${quizSetId}/result/`);
    return response;
  },
};

// History API
export const historyAPI = {
  async getUserHistory(filters?: {
    dateFrom?: string;
    dateTo?: string;
    level?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ results: QuizResult[]; count: number }> {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters?.dateTo) params.append('date_to', filters.dateTo);
    if (filters?.level) params.append('level', filters.level.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const response = await apiClient.get(`/api/history/?${params.toString()}`);
    return response;
  },

  async getQuizResult(quizSetId: string): Promise<QuizResult> {
    const response = await apiClient.get(`/api/history/${quizSetId}/`);
    return response;
  },
};
