// 英単語クイズアプリの型定義

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: 'student' | 'teacher' | 'admin';
  created_at: string;
  auth_id?: string;
  last_login?: string;
  level_preference?: number;
  quiz_count?: number;
  total_score?: number;
  average_score?: number;
}

export interface Word {
  id: string;
  text: string;
  pos: string; // 品詞
  level: number;
  tags: string[];
}

export interface WordTranslation {
  id: string;
  word_id: string;
  ja: string;
  is_correct: boolean;
}

export interface QuizSet {
  id: string;
  user_id?: string;
  mode: 'default' | 'random' | 'assignment';
  level: number;
  segment: number;
  question_count: number;
  assigned_by?: string;
  deadline?: string;
  started_at?: string;
  finished_at?: string;
  score?: number;
}

export interface QuizItem {
  id: string;
  quiz_set_id: string;
  word_id: string;
  word: Word;
  translations: WordTranslation[]; // 4択の選択肢
  order_no: number;
}

export interface QuizResponse {
  id: string;
  quiz_item_id: string;
  user_id: string;
  chosen_translation_id: string;
  is_correct: boolean;
  latency_ms: number;
  answered_at: string;
}

export interface QuizResult {
  quiz_set: QuizSet;
  quiz_items: QuizItem[];
  quiz_responses: QuizResponse[];
  total_score: number;
  total_questions: number;
  total_duration_ms: number;
  average_latency_ms: number;
}

export interface DashboardStats {
  total_quiz_sets: number;
  total_correct_answers: number;
  total_questions: number;
  average_score: number;
  average_latency_ms: number;
  recent_results: QuizResult[];
}

// API レスポンス型
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface QuizStartRequest {
  mode: 'default' | 'random';
  level: number;
  segment?: number;
  question_count?: number;
}

export interface QuizAnswerRequest {
  chosen_translation_id: string;
  latency_ms: number;
}

export interface QuizAnswerResponse {
  is_correct: boolean;
  correct_translation: WordTranslation;
  next_item_id?: string;
}
