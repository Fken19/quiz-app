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

// v2 API
export const v2API = {
  // Levels
  async getLevels(token: string) {
    const res = await apiFetch('/api/v2/levels/', {}, token).then(r => r.json());
    // DRF may return a paginated object { count, next, previous, results: [...] }
    // normalize to always return an array of levels
    if (res && Array.isArray((res as any).results)) return (res as any).results;
    return res as Array<{ level_id: string; level_name: string; created_at: string; updated_at: string }[]> as any;
  },

  // Segments (published only)
  async getSegments(levelId: string, token: string) {
    const res = await apiFetch(`/api/v2/segments/?level_id=${encodeURIComponent(levelId)}`, {}, token).then(r => r.json());
    // normalize paginated responses
    let segments = res && Array.isArray((res as any).results) ? (res as any).results : res;
    // Map segment_id to id for frontend compatibility
    if (Array.isArray(segments)) {
      segments = segments.map((segment: any) => ({
        ...segment,
        id: segment.segment_id || segment.id,
        label: segment.segment_name || segment.label || segment.name,
        description: segment.description || `${segment.word_count || 0} words`
      }));
    }
    return segments as Array<{ id: string; segment_id: string; label: string; description?: string; segment_name: string; publish_status: string; level: any; word_count: number }>;
  },

  // Segment quiz (10 questions)
  async getSegmentQuiz(segmentId: string, token: string) {
    const res = await apiFetch(`/api/v2/segments/${segmentId}/quiz/`, {}, token).then(r => r.json());
    return res as { segment_id: string; segment_name: string; level: any; questions: Array<{ order: number; word: any; choices: Array<{ text_ja: string; is_correct: boolean }> }> };
  },

  // Create quiz session
  async createSession(segmentId: string, token: string) {
    const resRaw = await apiFetch('/api/v2/quiz-sessions/', {
      method: 'POST',
      body: JSON.stringify({ segment: segmentId })
    }, token);
    // If backend returned error (400/4xx/5xx), try to parse body for details and throw
    if (!resRaw.ok) {
      let body: any = null;
      try {
        body = await resRaw.json();
      } catch (e) {
        try {
          body = await resRaw.text();
        } catch (_) {
          body = '<unreadable response body>';
        }
      }
      console.error('createSession failed', resRaw.status, body);
      throw new Error(`createSession failed: ${resRaw.status} - ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    const res = await resRaw.json();
    return res as { id: string; segment: { segment_id: string; segment_name: string } };
  },

  // Submit results
  async submitResults(sessionId: string, payload: { results: Array<{ word: string; question_order: number; selected_choice?: string | null; selected_text: string; is_correct: boolean; reaction_time_ms?: number | null }>; total_time_ms?: number }, token: string) {
    const resRaw = await apiFetch(`/api/v2/quiz-sessions/${sessionId}/submit_results/`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, token);
    if (!resRaw.ok) {
      let body: any = null;
      try {
        body = await resRaw.json();
      } catch (_) {
        try { body = await resRaw.text(); } catch { body = '<unreadable response body>'; }
      }
      // 既に完了済みのセッションは良性として扱う（多重送信の競合など）
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || '');
      if (bodyStr && bodyStr.includes('already completed')) {
        return { message: 'already completed', score: 0, score_percentage: 0 } as { message: string; score: number; score_percentage: number };
      }
      throw new Error(bodyStr || 'submit_results failed');
    }
    const res = await resRaw.json();
    return res as { message: string; score: number; score_percentage: number };
  },

  // Get session detail
  async getSession(sessionId: string, token: string) {
    const res = await apiFetch(`/api/v2/quiz-sessions/${sessionId}/`, {}, token).then(r => r.json());
    return res as { id: string; segment: { segment_id: string; segment_name: string }; started_at: string; completed_at?: string | null; score?: number; score_percentage?: number; is_completed?: boolean };
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
