import { apiFetch } from '@/lib/api';
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
  async login(credentials: { email: string; password: string }, token: string) {
    const response = await apiFetch('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }, token).then(res => res.json());
    return response;
  },

  async register(data: { email: string; password: string; display_name: string }, token: string) {
    const response = await apiFetch('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token).then(res => res.json());
    return response;
  },

  async logout(token: string) {
    const response = await apiFetch('/auth/logout/', {
      method: 'POST',
    }, token).then(res => res.json());
    return response;
  },

  async getProfile(token: string): Promise<User> {
    const response = await apiFetch('/auth/profile/', {}, token).then(res => res.json());
    return response;
  },

  async updateProfile(data: Partial<User>, token: string): Promise<User> {
    // If data is FormData (contains files), send directly using fetch to allow multipart
    if ((data as any) instanceof FormData) {
      const apiRoot = process.env.NEXT_PUBLIC_API_URL_BROWSER || 'http://localhost:8080';
      const res = await fetch(`${apiRoot}/user/profile/`, {
        method: 'POST',
        body: data as any,
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      });
      return res.json();
    }

    const response = await apiFetch('/auth/profile/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token).then(res => res.json());
    return response;
  },
};

// Dashboard API
export const dashboardAPI = {
  async getStats(token: string): Promise<DashboardStats> {
    const response = await apiFetch('/api/dashboard/stats/', {}, token).then(res => res.json());
    return response;
  },

  async getRecentResults(token: string): Promise<QuizResult[]> {
    const response = await apiFetch('/api/dashboard/recent-results/', {}, token).then(res => res.json());
    return response;
  },
};

// Word API
export const wordAPI = {
  async getWords(level: number, segment: number, token: string): Promise<Word[]> {
    const response = await apiFetch(`/api/words/?level=${level}&segment=${segment}`, {}, token).then(res => res.json());
    return response;
  },

  async getWord(id: string, token: string): Promise<Word> {
    const response = await apiFetch(`/api/words/${id}/`, {}, token).then(res => res.json());
    return response;
  },

  async getTranslations(wordId: string, token: string): Promise<WordTranslation[]> {
    const response = await apiFetch(`/api/words/${wordId}/translations/`, {}, token).then(res => res.json());
    return response;
  },
};

// Quiz API
export const quizAPI = {
  async createQuizSet(config: QuizConfig, token: string): Promise<QuizSet> {
    const response = await apiFetch('/api/quiz-sets/', {
      method: 'POST',
      body: JSON.stringify(config),
    }, token).then(res => res.json());
    return response;
  },

  async getQuizSet(id: string, token: string): Promise<QuizSet> {
    const response = await apiFetch(`/api/quiz-sets/${id}/`, {}, token).then(res => res.json());
    return response;
  },

  async getQuizItems(quizSetId: string, token: string): Promise<QuizItem[]> {
    const response = await apiFetch(`/api/quiz-sets/${quizSetId}/items/`, {}, token).then(res => res.json());
    return response;
  },

  async startQuiz(quizSetId: string, token: string): Promise<QuizSet> {
    const response = await apiFetch(`/api/quiz-sets/${quizSetId}/start/`, {
      method: 'POST',
    }, token).then(res => res.json());
    return response;
  },

  async submitAnswer(quizSetId: string, itemId: string, selectedTranslationId: string, token: string): Promise<QuizResponse> {
    const response = await apiFetch(`/api/quiz-sets/${quizSetId}/responses/`, {
      method: 'POST',
      body: JSON.stringify({
        quiz_item_id: itemId,
        selected_translation_id: selectedTranslationId,
      }),
    }, token).then(res => res.json());
    return response;
  },

  async finishQuiz(quizSetId: string, token: string): Promise<QuizResult> {
    const response = await apiFetch(`/api/quiz-sets/${quizSetId}/finish/`, {
      method: 'POST',
    }, token).then(res => res.json());
    return response;
  },

  async getQuizResult(quizSetId: string, token: string): Promise<QuizResult> {
    const response = await apiFetch(`/api/quiz-sets/${quizSetId}/result/`, {}, token).then(res => res.json());
    return response;
  },

  // 実際のバックエンドAPIエンドポイント
  async getQuizResultFromBackend(quizSetId: string): Promise<QuizResult> {
    const response = await fetch(`http://localhost:8080/api/quiz/result/${quizSetId}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch quiz result: ${response.statusText}`);
    }
    
    return response.json();
  },

  // フォーカス学習: ステータス別件数
  async getFocusStatusCounts(params: { level?: number | 'all' }, token: string): Promise<{ level_counts: any; total: any }>{
    const search = new URLSearchParams();
    if (params?.level !== undefined) search.set('level', String(params.level));
    const response = await apiFetch(`/api/focus/status-counts/?${search.toString()}`, {}, token).then(res => res.json());
    return response;
  },

  // フォーカス学習開始
  async startFocus(data: { status: 'unseen'|'weak'|'learned'|'strong'; level: number|'all'; count?: number; extend?: boolean; extend_levels?: number[] }, token: string) {
    const response = await apiFetch('/api/focus/start/', { method: 'POST', body: JSON.stringify(data) }, token).then(res => res.json());
    return response;
  }
};

// History API
export const historyAPI = {
  async getUserHistory(
    filters: {
      dateFrom?: string;
      dateTo?: string;
      level?: number;
      limit?: number;
      offset?: number;
    } = {},
    token: string
  ): Promise<{ results: QuizResult[]; count: number }> {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters?.dateTo) params.append('date_to', filters.dateTo);
    if (filters?.level) params.append('level', filters.level.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const response = await apiFetch(`/api/history/?${params.toString()}`, {}, token).then(res => res.json());
    return response;
  },

  async getQuizResult(quizSetId: string, token: string): Promise<QuizResult> {
    const response = await apiFetch(`/api/history/${quizSetId}/`, {}, token).then(res => res.json());
    return response;
  },
};
