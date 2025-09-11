import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardAPI, historyAPI, authAPI } from '@/services/api';
import { User } from '@/types/quiz';

// ダッシュボード関連のhooks
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.getStats(),
    staleTime: 2 * 60 * 1000, // 2分間はキャッシュを使用
  });
};

export const useRecentResults = () => {
  return useQuery({
    queryKey: ['recent-results'],
    queryFn: () => dashboardAPI.getRecentResults(),
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを使用
  });
};

// ヒストリー関連のhooks
export const useUserHistory = (filters?: {
  dateFrom?: string;
  dateTo?: string;
  level?: number;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ['user-history', filters],
    queryFn: () => historyAPI.getUserHistory(filters),
    staleTime: 1 * 60 * 1000, // 1分間はキャッシュを使用
  });
};

export const useHistoryQuizResult = (quizSetId: string | null) => {
  return useQuery({
    queryKey: ['history-quiz-result', quizSetId],
    queryFn: () => historyAPI.getQuizResult(quizSetId!),
    enabled: !!quizSetId,
  });
};

// ユーザープロフィール関連のhooks
export const useUserProfile = () => {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: () => authAPI.getProfile(),
    staleTime: 10 * 60 * 1000, // 10分間はキャッシュを使用
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<User>) => authAPI.updateProfile(data),
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData(['user-profile'], updatedUser);
    },
  });
};

// 認証関連のhooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => 
      authAPI.login(credentials),
    onSuccess: () => {
      // ログイン成功後、ユーザープロフィールを取得
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { email: string; password: string; display_name: string }) => 
      authAPI.register(data),
    onSuccess: () => {
      // 登録成功後、ユーザープロフィールを取得
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authAPI.logout(),
    onSuccess: () => {
      // ログアウト後、すべてのキャッシュをクリア
      queryClient.clear();
    },
  });
};
