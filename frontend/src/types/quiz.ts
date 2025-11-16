export interface ApiUser {
  user_id: string;
  email: string;
  oauth_provider: string;
  oauth_sub: string;
  disabled_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface UserProfile {
  user: string;
  display_name: string;
  avatar_url: string;
  grade?: string | null;
  self_intro?: string | null;
  updated_at: string;
}

export interface Teacher {
  teacher_id: string;
  email: string;
  oauth_provider: string;
  oauth_sub: string;
  last_login: string | null;
  disabled_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherProfile {
  teacher: string;
  display_name?: string | null;
  affiliation?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  updated_at: string;
}

export interface TeacherWhitelistEntry {
  teachers_whitelist_id: string;
  email: string;
  can_publish_vocab: boolean;
  note?: string | null;
  revoked_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationCode {
  invitation_code_id: string;
  invitation_code: string;
  issued_by: string;
  issued_at: string;
  expires_at?: string | null;
  used_by?: string | null;
  used_at?: string | null;
  revoked: boolean;
  revoked_at?: string | null;
}

export interface StudentTeacherLink {
  student_teacher_link_id: string;
  teacher: string;
  teacher_email?: string;
  teacher_display_name?: string;
  student: string;
  status: 'pending' | 'active' | 'revoked';
  linked_at: string;
  revoked_at?: string | null;
  revoked_by_teacher?: string | null;
  revoked_by_student?: string | null;
  invitation?: string | null;
  custom_display_name?: string | null;
  private_note?: string | null;
  local_student_code?: string | null;
  tags?: string[];
  kana_for_sort?: string | null;
  color?: string | null;
  updated_at: string;
}

export interface RosterFolder {
  roster_folder_id: string;
  owner_teacher: string;
  parent_folder?: string | null;
  name: string;
  sort_order: number;
  is_dynamic: boolean;
  dynamic_filter?: unknown;
  notes?: string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface RosterMembership {
  roster_membership_id: string;
  roster_folder: string;
  student: string;
  added_at: string;
  removed_at?: string | null;
  note?: string | null;
}

export interface Vocabulary {
  vocabulary_id: string;
  text_en: string;
  text_key: string;
  part_of_speech?: string | null;
  explanation?: string | null;
  example_en?: string | null;
  example_ja?: string | null;
  sort_key: string;
  head_letter: string;
  sense_count: number;
  visibility: 'private' | 'public';
  status: 'draft' | 'proposed' | 'published' | 'archived';
  created_by_user?: string | null;
  created_by_teacher?: string | null;
  alias_of?: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VocabTranslation {
  vocab_translation_id: string;
  vocabulary: string;
  text_ja: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface VocabChoice {
  vocab_choice_id: string;
  vocabulary: string;
  text_ja: string;
  is_correct: boolean;
  weight: string;
  source_vocabulary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizCollection {
  quiz_collection_id: string;
  scope: 'default' | 'custom';
  owner_user?: string | null;
  title: string;
  description?: string | null;
  level_code?: string | null;
  level_label?: string | null;
  level_order: number;
  order_index: number;
  is_published: boolean;
  published_at?: string | null;
  origin_collection?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  quiz_id: string;
  quiz_collection: string;
  sequence_no: number;
  title?: string | null;
  section_no?: number | null;
  section_label?: string | null;
  timer_seconds?: number | null;
  origin_quiz?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  quiz_question_id: string;
  quiz: string;
  vocabulary: string;
  question_order: number;
  note?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizResult {
  quiz_result_id: string;
  user: string;
  quiz: string;
  started_at: string;
  completed_at?: string | null;
  total_time_ms?: number | null;
  score?: number | null;
  question_count: number;
  timeout_count: number;
}

export interface QuizResultDetail {
  quiz_result_detail_id: string;
  quiz_result: string;
  question_order: number;
  vocabulary: string;
  selected_text?: string | null;
  is_correct: boolean;
  is_timeout: boolean;
  reaction_time_ms?: number | null;
  created_at: string;
}

export interface UserVocabStatus {
  user_vocab_status_id: string;
  user: string;
  vocabulary: string;
  status: 'unlearned' | 'weak' | 'learning' | 'mastered';
  last_result?: 'correct' | 'incorrect' | 'timeout' | null;
  last_answered_at?: string | null;
  recent_correct_streak: number;
  total_answer_count: number;
  total_correct_count: number;
  timeout_count: number;
  created_at: string;
  updated_at: string;
}

export interface LearningActivityLog {
  learning_activity_log_id: string;
  user: string;
  quiz_result: string;
  occurred_at: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms: number;
}

export interface LearningSummaryDaily {
  learning_summary_daily_id: string;
  user: string;
  activity_date: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms: number;
  streak_count: number;
  updated_at: string;
}

export type LearningStatusKey = 'unlearned' | 'weak' | 'learning' | 'mastered';

export interface DashboardFocusSummary {
  unlearned: { count: number };
  weak: { count: number };
  learning: { count: number };
  mastered: { count: number };
}

export interface DashboardDailyChartItem {
  date: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms?: number;
  mastered_count?: number;
}

export interface DashboardPeriodChartItem {
  period: string;
  label: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms?: number;
  mastered_count?: number;
  from_date?: string;
  to_date?: string;
}

export interface StudentDashboardSummary {
  user: ApiUser;
  streak: {
    current: number;
    best: number;
  };
  today_summary: {
    correct_count: number;
    incorrect_count: number;
    timeout_count: number;
    total_time_ms: number;
  };
  weekly_summary: {
    correct_count: number;
    incorrect_count: number;
    timeout_count: number;
    total_time_ms: number;
  };
  recent_daily: {
    chart: DashboardDailyChartItem[];
    max_total: number;
  };
  weekly_chart?: {
    chart: DashboardPeriodChartItem[];
    max_total: number;
  };
  monthly_chart?: {
    chart: DashboardPeriodChartItem[];
    max_total: number;
  };
  focus_summary: DashboardFocusSummary;
  quiz_result_count: number;
  test_result_count: number;
  pending_tests: number;
}

export interface FocusQuestionsResponse {
  status: LearningStatusKey;
  requested_limit: number;
  available_count: number;
  primary_count?: number;
  filled_from?: Array<{ status: LearningStatusKey; count: number }>;
  vocabulary_ids: string[];
  preview: Array<{
    vocabulary_id: string;
    text_en: string | null;
  }>;
}

export interface FocusQuizSessionResponse {
  quiz_id: string;
  question_count: number;
}

export interface Test {
  test_id: string;
  teacher: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  max_attempts_per_student: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestQuestion {
  test_question_id: string;
  test: string;
  vocabulary: string;
  question_order: number;
  weight?: string | null;
  timer_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface TestAssignment {
  test_assignment_id: string;
  test: string;
  assigned_by_teacher?: string | null;
  assigned_at: string;
  note?: string | null;
  run_params?: unknown;
}

export interface TestAssignee {
  test_assignee_id: string;
  test: string;
  student: string;
  test_assignment?: string | null;
  source_type?: 'folder' | 'manual' | 'api' | null;
  source_folder?: string | null;
  assigned_by_teacher?: string | null;
  assigned_at: string;
  max_attempts?: number | null;
}

export interface TestResult {
  test_result_id: string;
  test: string;
  student: string;
  test_assignee?: string | null;
  attempt_no: number;
  started_at: string;
  completed_at?: string | null;
  score?: number | null;
}

export interface TestResultDetail {
  test_result_detail_id: string;
  test_result: string;
  question_order: number;
  vocabulary: string;
  selected_choice?: string | null;
  selected_text?: string | null;
  is_correct?: boolean | null;
  reaction_time_ms?: number | null;
  created_at: string;
}

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
