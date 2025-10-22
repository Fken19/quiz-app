import { apiRequest } from '@/lib/api-utils';
import type {
  ApiUser,
  UserProfile,
  Teacher,
  TeacherProfile,
  TeacherWhitelistEntry,
  InvitationCode,
  StudentTeacherLink,
  RosterFolder,
  RosterMembership,
  Vocabulary,
  VocabTranslation,
  VocabChoice,
  QuizCollection,
  Quiz,
  QuizQuestion,
  QuizResult,
  QuizResultDetail,
  Test,
  TestQuestion,
  TestAssignment,
  TestAssignee,
  TestResult,
  TestResultDetail,
  PaginatedResponse,
} from '@/types/quiz';

const buildListUrl = (base: string, params?: Record<string, string | number | boolean | undefined | null>) => {
  if (!params) return base;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    usp.set(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
};

const get = <T>(url: string) => apiRequest(url) as Promise<T>;
const post = <T>(url: string, body: unknown) =>
  apiRequest(url, { method: 'POST', body: JSON.stringify(body) }) as Promise<T>;
const patch = <T>(url: string, body: unknown) =>
  apiRequest(url, { method: 'PATCH', body: JSON.stringify(body) }) as Promise<T>;
const del = (url: string) => apiRequest(url, { method: 'DELETE' });

const crud = <T, C = Partial<T>>(base: string) => ({
  list: (params?: Record<string, string | number | boolean | undefined | null>) =>
    get<PaginatedResponse<T> | T[]>(buildListUrl(base, params)),
  retrieve: (id: string) => get<T>(`${base}${id}/`),
  create: (payload: C) => post<T>(base, payload),
  update: (id: string, payload: C) => patch<T>(`${base}${id}/`, payload),
  destroy: (id: string) => del(`${base}${id}/`),
});

export const usersApi = crud<ApiUser, Partial<ApiUser>>('/api/users/');
export const userProfilesApi = crud<UserProfile, Partial<UserProfile>>('/api/user-profiles/');
export const teachersApi = crud<Teacher, Partial<Teacher>>('/api/teachers/');
export const teacherProfilesApi = crud<TeacherProfile, Partial<TeacherProfile>>('/api/teacher-profiles/');
export const teacherWhitelistsApi = crud<TeacherWhitelistEntry, Partial<TeacherWhitelistEntry>>('/api/teacher-whitelists/');
export const invitationCodesApi = crud<InvitationCode, Partial<InvitationCode>>('/api/invitation-codes/');
export const studentTeacherLinksApi = crud<StudentTeacherLink, Partial<StudentTeacherLink>>('/api/student-teacher-links/');
export const rosterFoldersApi = crud<RosterFolder, Partial<RosterFolder>>('/api/roster-folders/');
export const rosterMembershipsApi = crud<RosterMembership, Partial<RosterMembership>>('/api/roster-memberships/');
export const vocabulariesApi = crud<Vocabulary, Partial<Vocabulary>>('/api/vocabularies/');
export const vocabTranslationsApi = crud<VocabTranslation, Partial<VocabTranslation>>('/api/vocab-translations/');
export const vocabChoicesApi = crud<VocabChoice, Partial<VocabChoice>>('/api/vocab-choices/');
export const quizCollectionsApi = crud<QuizCollection, Partial<QuizCollection>>('/api/quiz-collections/');
export const quizzesApi = crud<Quiz, Partial<Quiz>>('/api/quizzes/');
export const quizQuestionsApi = crud<QuizQuestion, Partial<QuizQuestion>>('/api/quiz-questions/');
export const quizResultsApi = crud<QuizResult, Partial<QuizResult>>('/api/quiz-results/');
export const quizResultDetailsApi = crud<QuizResultDetail, Partial<QuizResultDetail>>('/api/quiz-result-details/');
export const testsApi = crud<Test, Partial<Test>>('/api/tests/');
export const testQuestionsApi = crud<TestQuestion, Partial<TestQuestion>>('/api/test-questions/');
export const testAssignmentsApi = crud<TestAssignment, Partial<TestAssignment>>('/api/test-assignments/');
export const testAssigneesApi = crud<TestAssignee, Partial<TestAssignee>>('/api/test-assignees/');
export const testResultsApi = crud<TestResult, Partial<TestResult>>('/api/test-results/');
export const testResultDetailsApi = crud<TestResultDetail, Partial<TestResultDetail>>('/api/test-result-details/');

export const dashboardApi = {
  summary: () => get<Record<string, unknown>>('/api/dashboard/stats/'),
};
