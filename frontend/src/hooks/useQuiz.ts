import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizAPI, wordAPI, QuizConfig } from '@/services/api';
import { QuizSet, QuizItem, QuizResponse, QuizResult } from '@/types/quiz';
import { useSession } from 'next-auth/react';

// クイズセット関連のhooks
export const useCreateQuizSet = () => {
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const token = session?.backendAccessToken;
  console.log('useCreateQuizSet token:', token, 'status:', status);
  const mutation = useMutation({
    mutationFn: async (config: QuizConfig) => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.createQuizSet(config, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sets'] });
    },
  });
  return { mutation, status, token };
};


export const useQuizSet = (id: string | null) => {
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useQuery({
    queryKey: ['quiz-set', id],
    queryFn: async () => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.getQuizSet(id!, token);
    },
    enabled: !!id,
  });
};


export const useQuizItems = (quizSetId: string | null) => {
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useQuery({
    queryKey: ['quiz-items', quizSetId],
    queryFn: async () => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.getQuizItems(quizSetId!, token);
    },
    enabled: !!quizSetId,
  });
};


export const useStartQuiz = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useMutation({
    mutationFn: async (quizSetId: string) => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.startQuiz(quizSetId, token);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quiz-set', data.id], data);
    },
  });
};


export const useSubmitAnswer = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useMutation({
    mutationFn: async ({
      quizSetId,
      itemId,
      selectedTranslationId,
    }: {
      quizSetId: string;
      itemId: string;
      selectedTranslationId: string;
    }) => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.submitAnswer(quizSetId, itemId, selectedTranslationId, token);
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ['quiz-responses', variables.quizSetId],
        (old: QuizResponse[] = []) => [...old, data]
      );
    },
  });
};


export const useFinishQuiz = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useMutation({
    mutationFn: async (quizSetId: string) => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.finishQuiz(quizSetId, token);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quiz-result', data.quiz_set.id], data);
      queryClient.invalidateQueries({ queryKey: ['user-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
};


export const useQuizResult = (quizSetId: string | null) => {
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useQuery({
    queryKey: ['quiz-result', quizSetId],
    queryFn: async () => {
      if (!token) throw new Error('No backendAccessToken');
      return quizAPI.getQuizResult(quizSetId!, token);
    },
    enabled: !!quizSetId,
  });
};

// 単語関連のhooks

export const useWords = (level: number, segment: number) => {
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useQuery({
    queryKey: ['words', level, segment],
    queryFn: async () => {
      if (!token) throw new Error('No backendAccessToken');
      return wordAPI.getWords(level, segment, token);
    },
    staleTime: 5 * 60 * 1000,
  });
};


export const useWord = (id: string | null) => {
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useQuery({
    queryKey: ['word', id],
    queryFn: async () => {
      if (!token) throw new Error('No backendAccessToken');
      return wordAPI.getWord(id!, token);
    },
    enabled: !!id,
  });
};


export const useWordTranslations = (wordId: string | null) => {
  const { data: session } = useSession();
  const token = session?.backendAccessToken;
  return useQuery({
    queryKey: ['word-translations', wordId],
    queryFn: async () => {
      if (!token) throw new Error('No backendAccessToken');
      return wordAPI.getTranslations(wordId!, token);
    },
    enabled: !!wordId,
  });
};

// カスタムhooks for quiz state management
export const useQuizState = (quizSetId: string | null) => {
  const { data: quizSet, isLoading: quizLoading } = useQuizSet(quizSetId);
  const { data: quizItems, isLoading: itemsLoading } = useQuizItems(quizSetId);
  const submitAnswerMutation = useSubmitAnswer();
  const finishQuizMutation = useFinishQuiz();

  const isLoading = quizLoading || itemsLoading;

  const submitAnswer = async (itemId: string, selectedTranslationId: string) => {
    if (!quizSetId) return;
    
    return submitAnswerMutation.mutateAsync({
      quizSetId,
      itemId,
      selectedTranslationId,
    });
  };

  const finishQuiz = async () => {
    if (!quizSetId) return;
    
    return finishQuizMutation.mutateAsync(quizSetId);
  };

  return {
    quizSet,
    quizItems,
    isLoading,
    submitAnswer,
    finishQuiz,
    isSubmitting: submitAnswerMutation.isPending,
    isFinishing: finishQuizMutation.isPending,
  };
};
