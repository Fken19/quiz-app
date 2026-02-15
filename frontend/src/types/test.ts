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
}

/** Test テンプレート */
export interface Test {
  test_id: string;
  teacher: string; // teacher ID
  title: string;
  description?: string;
  due_at?: string | null;
  max_attempts_per_student?: number;
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
  note?: string;
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
  assignment_schedule?: {
    start_at: string;
    end_at: string;
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
  };
  questions: StudentTestQuestion[];
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
