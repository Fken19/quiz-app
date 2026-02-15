/**
 * Test Feature API Layer
 */

'use client';

import { apiGet, apiPost } from '../api-utils';
import type {
  Test,
  TestQuestion,
  TestAssignment,
  CreateTestRequest,
  CreateTestQuestionsRequest,
  CreateTestAssignmentRequest,
  AssignStudentsRequest,
  StudentTestListResponse,
  StudentTestDetailResponse,
  AttemptStartResponse,
  SubmitAnswersRequest,
  SubmitAnswersResponse,
  AttemptResultResponse,
  TeacherAssignmentResultsResponse,
} from '@/types/test';

// ============================================================================
// 講師向け API
// ============================================================================

/**
 * テストを作成
 * POST /api/tests/
 */
export async function createTest(payload: CreateTestRequest): Promise<Test> {
  return apiPost('/tests/', payload);
}

/**
 * テストを取得
 * GET /api/tests/{id}/
 */
export async function getTest(testId: string): Promise<Test> {
  return apiGet(`/tests/${testId}/`);
}

/**
 * テスト一覧を取得（講師）
 * GET /api/tests/
 */
export async function getTeacherTests(): Promise<{ results: Test[] }> {
  return apiGet('/tests/?page_size=100');
}

/**
 * テストに問題を追加
 * POST /api/tests/{id}/questions/create
 */
export async function createTestQuestions(
  testId: string,
  payload: CreateTestQuestionsRequest
): Promise<TestQuestion[]> {
  const response = await apiPost(`/tests/${testId}/questions/create/`, payload);
  // レスポンスが配列の場合と、ラップされている場合に対応
  return Array.isArray(response) ? response : response.results || [response];
}

/**
 * テスト配信を作成
 * POST /api/test-assignments/
 */
export async function createTestAssignment(
  payload: CreateTestAssignmentRequest
): Promise<TestAssignment> {
  return apiPost('/test-assignments/', payload);
}

/**
 * テスト配信を取得
 * GET /api/test-assignments/{id}/
 */
export async function getTestAssignment(assignmentId: string): Promise<TestAssignment> {
  return apiGet(`/test-assignments/${assignmentId}/`);
}

/**
 * テスト配信一覧を取得（講師）
 * GET /api/test-assignments/
 */
export async function getTeacherTestAssignments(): Promise<{ results: TestAssignment[] }> {
  return apiGet('/test-assignments/?page_size=100');
}

/**
 * テスト配信で学生に配信
 * POST /api/test-assignments/{id}/assign-students
 */
export async function assignStudents(
  assignmentId: string,
  payload: AssignStudentsRequest
): Promise<{ assigned_count: number }> {
  return apiPost(`/test-assignments/${assignmentId}/assign-students/`, payload);
}

/**
 * 配信結果一覧を取得（講師）
 * GET /api/teacher/test-assignments/{assignment_id}/results
 */
export async function getTeacherAssignmentResults(
  assignmentId: string
): Promise<TeacherAssignmentResultsResponse> {
  return apiGet(`/teacher/test-assignments/${assignmentId}/results`);
}

/**
 * 配信結果CSVをダウンロード（講師）
 * GET /api/teacher/test-assignments/{assignment_id}/results.csv
 */
export function downloadTeacherAssignmentResultsCSV(assignmentId: string): void {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';
  const url = `${baseUrl}/teacher/test-assignments/${assignmentId}/results.csv`;
  
  // 認証トークンを取得
  const token = localStorage.getItem('access_token');
  
  // fetch でダウンロード
  fetch(url, {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
  })
    .then(response => response.blob())
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `test_results_${assignmentId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    })
    .catch(error => {
      console.error('CSV download failed:', error);
      alert('CSVのダウンロードに失敗しました');
    });
}

// ============================================================================
// 学生向け API
// ============================================================================

/**
 * 学生に配信されたテスト一覧を取得
 * GET /api/student/tests/
 */
export async function getStudentTests(): Promise<StudentTestListResponse> {
  return apiGet('/student/tests/');
}

/**
 * テスト詳細と問題一覧を取得（学生）
 * GET /api/student/tests/{assignment_id}/
 */
export async function getStudentTestDetail(
  assignmentId: string
): Promise<StudentTestDetailResponse> {
  return apiGet(`/student/tests/${assignmentId}/`);
}

/**
 * 受験を開始
 * POST /api/student/tests/{assignment_id}/attempts/start
 */
export async function startAttempt(assignmentId: string): Promise<AttemptStartResponse> {
  return apiPost(`/student/tests/${assignmentId}/attempts/start/`, {});
}

/**
 * 回答を提出（採点実行）
 * POST /api/student/attempts/{attempt_id}/submit
 */
export async function submitAnswers(
  attemptId: string,
  payload: SubmitAnswersRequest
): Promise<SubmitAnswersResponse> {
  return apiPost(`/student/attempts/${attemptId}/submit/`, payload);
}

/**
 * 受験結果を取得
 * GET /api/student/attempts/{attempt_id}/result
 */
export async function getStudentAttemptResult(
  attemptId: string
): Promise<AttemptResultResponse> {
  return apiGet(`/student/attempts/${attemptId}/result/`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * テスト配信作成フロー
 * 1. createTest でテンプレート作成
 * 2. createTestQuestions で問題追加
 * 3. createTestAssignment で配信指定作成
 * 4. assignStudents で学生に割り当て
 */
export async function createAndAssignTest(
  testData: CreateTestRequest,
  questions: CreateTestQuestionsRequest['questions'],
  assignmentData: Omit<CreateTestAssignmentRequest, 'test'>,
  assignmentTargets: AssignStudentsRequest
): Promise<{
  test: Test;
  questions: TestQuestion[];
  assignment: TestAssignment;
  assigned_count: number;
}> {
  // Step 1: Create test
  const test = await createTest(testData);

  // Step 2: Add questions
  const createdQuestions = await createTestQuestions(test.test_id, { questions });

  // Step 3: Create assignment
  const assignment = await createTestAssignment({
    ...assignmentData,
    test: test.test_id,
  });

  // Step 4: Assign to students
  const assignResult = await assignStudents(assignment.test_assignment_id, assignmentTargets);

  return {
    test,
    questions: createdQuestions,
    assignment,
    assigned_count: assignResult.assigned_count,
  };
}
