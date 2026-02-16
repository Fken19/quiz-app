/**
 * Test Feature Types
 * 
 * テスト機能関連の型定義（講師テスト作成・配信、学生回答）
 */

// ============================================================================
// Base Models
// ============================================================================

/** Test スケジュール */
export interface TestSchedule {
  start_at: string; // ISO8601 +09:00 format: "2025-02-01T09:00:00+09:00"
  end_at: string;   // ISO8601 +09:00 format
}

/** Test タイマー設定 */
export interface TestTimer {
  mode: "uniform"; // MVP: uniform のみ（全問題同一タイマー）
  seconds: number;
}

/** Test 試行回数設定 */
export interface TestAttempts {
  default_max_attempts: number;
  source_of_truth: "testassignee" | "test";
}

/** Test 配信対象スナップショット */
export interface TestTargetsSnapshot {
  students: string[]; // student user IDs
  groups: string[];   // roster folder IDs
}

/** Test Assignment Run Parameters v1 */
export interface TestAssignmentRunParamsV1 {
  schema_version: 1;
  timezone: "Asia/Tokyo";
  schedule?: TestSchedule;
  timer?: TestTimer;
  attempts?: TestAttempts;
  override_translations?: Record<string, Record<string, string>>; // vocab_id -> {lang: translation}
  ui?: Record<string, unknown>;
  targets_snapshot?: TestTargetsSnapshot;
  control?: {
    paused?: boolean;
  };
  announcement?: {
    message?: string | null;
    updated_at?: string | null;
  };
  passing?: {
    percentage?: number | null;
  };
}

/** Test テンプレート */
export interface Test {
  test_id: string;
  teacher: string; // teacher ID
  title: string;
  description?: string | null;
  due_at?: string | null;
  max_attempts_per_student?: number;
  archived_at?: string | null;
  question_count?: number;
  created_at: string;
  updated_at: string;
}

/** Test Question */
export interface TestQuestion {
  test_question_id: string;
  test: string; // test ID
  vocabulary: string; // vocabulary ID
  question_order: number;
  weight?: number;
  timer_seconds?: number;
}

/** Test Assignment 配信指定 */
export interface TestAssignment {
  test_assignment_id: string;
  test: string; // test ID
  assigned_by_teacher: string; // teacher ID
  assigned_at: string;
  note?: string | null;
  run_params?: TestAssignmentRunParamsV1;
}

/** Test Assignee 配信対象者 */
export interface TestAssignee {
  test_assignee_id: string;
  test: string;
  student: string;
  test_assignment: string;
  source_type: "direct" | "group";
  source_folder?: string | null;
  assigned_by_teacher: string;
  assigned_at: string;
  max_attempts?: number | null;
}

/** Test Result 回答結果 */
export interface TestResult {
  test_result_id: string;
  test: string;
  student: string;
  test_assignee: string;
  attempt_no: number;
  started_at: string;
  completed_at?: string | null;
  score?: number | null;
}

/** Test Result Detail 問題別回答結果 */
export interface TestResultDetail {
  test_result_detail_id: string;
  test_result: string;
  question_order: number;
  vocabulary: string;
  selected_choice?: string | null; // VocabChoice ID
  selected_text?: string | null;
  is_correct?: boolean | null;
  reaction_time_ms?: number;
  created_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/** Test 作成リクエスト */
export interface CreateTestRequest {
  title: string;
  description?: string;
  due_at?: string | null;
  max_attempts_per_student?: number;
}

/** Test Questions 追加リクエスト */
export interface CreateTestQuestionsRequest {
  questions: Array<{
    vocabulary_id: string;
    question_order: number;
    timer_seconds?: number;
  }>;
}

/** Test 作成 + 問題セット作成リクエスト */
export interface CreateTestWithQuestionsRequest {
  title: string;
  description?: string | null;
  vocabulary_ids: string[];
}

/** Test 問題セット差し替えリクエスト */
export interface ReplaceTestQuestionsRequest {
  vocabulary_ids: string[];
}

/** Test Assignment 作成リクエスト */
export interface CreateTestAssignmentRequest {
  test: string;
  note?: string;
  run_params?: Partial<TestAssignmentRunParamsV1>;
}

/** Test Assignment 学生配信リクエスト */
export interface AssignStudentsRequest {
  students?: string[]; // student user IDs
  groups?: string[];   // roster folder IDs
}

/** 学生用 - 利用可能テスト情報 */
export interface AvailableTest {
  test_id: string;
  assignment_id: string;  // ★ 詳細取得時に使用
  title: string;
  description: string;
  max_attempts: number;
  attempts_remaining: number;
  attempts_completed: number;
  is_available: boolean;
  is_paused?: boolean;
  passing_percentage?: number | null;
  best_score?: number | null;
  latest_score?: number | null;
  is_passed?: boolean | null;
  show_test_content?: boolean;
  announcement?: {
    message: string | null;
    updated_at: string | null;
  } | null;
  assignment_schedule?: {
    start_at: string;
    end_at: string;
  } | null;
  assignment_schedule_display?: {
    start_at: string | null;
    end_at: string | null;
  } | null;
}

/** 学生用 - テスト一覧取得レスポンス */
export interface StudentTestListResponse {
  available_tests: AvailableTest[];
}

/** Vocabulary 選択肢（学生向け：is_correct なし） */
export interface StudentVocabChoice {
  id: string;
  text_ja: string;
}

/** Vocabulary 翻訳（学生向け） */
export interface StudentVocabTranslation {
  text_ja: string;
  is_primary: boolean;
  is_override?: boolean; // override_translations から
}

/** Vocabulary 詳細（学生向け） */
export interface StudentVocabForTest {
  id: string;
  text_en: string;
  part_of_speech: string;
  explanation?: string;
  example_en?: string;
  example_ja?: string;
  translations: StudentVocabTranslation[];
  choices: StudentVocabChoice[];
}

/** Test 問題（学生向け） */
export interface StudentTestQuestion {
  question_order: number;
  vocabulary: StudentVocabForTest;
  timer_seconds?: number;
}

/** 学生用 - テスト詳細取得レスポンス */
export interface StudentTestDetailResponse {
  test: {
    test_id: string;
    title: string;
    description: string;
    max_attempts: number;
    time_limit_seconds?: number;
    passing_percentage?: number | null;
  };
  is_paused?: boolean;
  announcement?: {
    message: string | null;
    updated_at: string | null;
  } | null;
  questions: StudentTestQuestion[];
}

/** 受験結果詳細 */
export interface AttemptResultDetail {
  question_order: number;
  vocabulary_id: string;
  english_word: string;
  selected_choice_id: string | null;
  selected_text_ja: string;
  is_correct: boolean;
  correct_text_ja: string | null;  // 正解の訳（結果表示時のみ）
  reaction_time_ms: number | null;
}

/** 受験結果取得レスポンス */
export interface AttemptResultResponse {
  attempt_id: string;
  assignment_id: string;
  test_id: string;
  test_title: string;
  attempt_no: number;
  started_at: string;  // ISO8601
  completed_at: string;  // ISO8601
  score: number;  // 100点満点
  total_questions: number;
  correct_count: number;
  total_time_ms: number;
  details: AttemptResultDetail[];
}

/** 学生用 - 配信ごとの受験結果一覧レスポンス */
export interface StudentAssignmentResultsResponse {
  assignment_id: string;
  test_id: string;
  test_title: string;
  passing_percentage?: number | null;
  results: Array<{
    attempt_id: string;
    attempt_no: number;
    started_at: string | null;
    completed_at: string | null;
    score: number | null;
    total_questions: number;
    correct_count: number;
    total_time_ms: number;
  }>;
  announcement?: {
    message: string | null;
    updated_at: string | null;
  } | null;
}

/** 受験開始レスポンス */
export interface AttemptStartResponse {
  attempt_id: string;
  attempt_no: number;
  timer_seconds: number;
  questions: StudentTestQuestion[];
  announcement?: {
    message: string | null;
    updated_at: string | null;
  } | null;
}

/** 回答入力 */
export interface AnswerInput {
  question_order: number;
  choice_id: string | null;
  reaction_time_ms: number | null;
}

/** 提出リクエスト */
export interface SubmitAnswersRequest {
  answers: AnswerInput[];
}

/** 提出レスポンス */
export interface SubmitAnswersResponse {
  attempt_id: string;
  score: number;
  total_questions: number;
  correct_count: number;
  total_time_ms: number;
  answers: Array<{
    question_order: number;
    vocabulary_id: string;
    vocabulary_text_en: string;
    selected_text: string;
    is_correct: boolean;
    reaction_time_ms: number | null;
  }>;
}

// ============================================================================
// Teacher Result Views
// ============================================================================

/** 講師向け配信結果（1行） */
export interface TeacherAssignmentResult {
  assignee_id: string;
  student_id: string;
  student_name: string;
  status: 'attempted' | 'unattempted' | 'expired_unattempted';
  attempt_count: number;
  completed_count: number;
  best_score: number | null;
  latest_score: number | null;
  latest_completed_at: string | null;
  remaining_attempts: number;
}

/** 講師向け配信結果一覧レスポンス */
export interface TeacherAssignmentResultsResponse {
  assignment: {
    id: string;
    test_id: string;
    title: string;
    schedule: {
      start_at: string | null;
      end_at: string | null;
    };
  };
  summary: {
    assignee_count: number;
    attempted_count: number;
    unattempted_count: number;
  };
  rows: TeacherAssignmentResult[];
}

/** 講師用 語彙一覧アイテム */
export interface TeacherVocabularyListItem {
  vocabulary_id: string;
  text_en: string;
  part_of_speech?: string | null;
  primary_translation?: string | null;
}

export interface TeacherVocabularyTranslation {
  vocab_translation_id: string;
  text_ja: string;
  is_primary: boolean;
}

export interface TeacherVocabularyChoice {
  vocab_choice_id: string;
  text_ja: string;
  is_correct: boolean;
}

export interface TeacherVocabularyDetail {
  vocabulary_id: string;
  text_en: string;
  part_of_speech?: string | null;
  explanation?: string | null;
  example_en?: string | null;
  example_ja?: string | null;
  translations: TeacherVocabularyTranslation[];
  choices: TeacherVocabularyChoice[];
}

export interface TestQuestionSummaryResponse {
  questions: TeacherVocabularyListItem[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * ISO8601 +09:00 形式の日付文字列をパース
 * @param dateString "2025-02-01T09:00:00+09:00" 形式
 * @returns Date オブジェクト（UTC）
 */
export function parseTestDateTime(dateString: string): Date {
  return new Date(dateString);
}

/**
 * テストが現在時刻で利用可能か判定
 * @param schedule スケジュール情報
 * @param now 比較対象の日時（デフォルト：現在時刻）
 * @returns 利用可能ならtrue
 */
export function isTestAvailable(
  schedule: TestSchedule | undefined,
  now: Date = new Date()
): boolean {
  if (!schedule) return false;
  const start = parseTestDateTime(schedule.start_at);
  const end = parseTestDateTime(schedule.end_at);
  return start <= now && now <= end;
}
