import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizAPI, wordAPI, QuizConfig } from '@/services/api';
import { QuizSet, QuizItem, QuizResponse, QuizResult } from '@/types/quiz';

// クイズセット関連のhooks
export const useCreateQuizSet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config: QuizConfig) => quizAPI.createQuizSet(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sets'] });
    },
  });
};

export const useQuizSet = (id: string | null) => {
  return useQuery({
    queryKey: ['quiz-set', id],
    queryFn: () => quizAPI.getQuizSet(id!),
    enabled: !!id,
  });
};

export const useQuizItems = (quizSetId: string | null) => {
  return useQuery({
    queryKey: ['quiz-items', quizSetId],
    queryFn: () => quizAPI.getQuizItems(quizSetId!),
    enabled: !!quizSetId,
  });
};

export const useStartQuiz = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (quizSetId: string) => quizAPI.startQuiz(quizSetId),
    onSuccess: (data) => {
      queryClient.setQueryData(['quiz-set', data.id], data);
    },
  });
};

export const useSubmitAnswer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      quizSetId,
      itemId,
      selectedTranslationId,
    }: {
      quizSetId: string;
      itemId: string;
      selectedTranslationId: string;
    }) => quizAPI.submitAnswer(quizSetId, itemId, selectedTranslationId),
    onSuccess: (data, variables) => {
      // 回答を即座にキャッシュに反映
      queryClient.setQueryData(
        ['quiz-responses', variables.quizSetId],
        (old: QuizResponse[] = []) => [...old, data]
      );
    },
  });
};

export const useFinishQuiz = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (quizSetId: string) => quizAPI.finishQuiz(quizSetId),
    onSuccess: (data) => {
      queryClient.setQueryData(['quiz-result', data.quiz_set.id], data);
      queryClient.invalidateQueries({ queryKey: ['user-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
};

export const useQuizResult = (quizSetId: string | null) => {
  return useQuery({
    queryKey: ['quiz-result', quizSetId],
    queryFn: () => quizAPI.getQuizResult(quizSetId!),
    enabled: !!quizSetId,
  });
};

// 単語関連のhooks
export const useWords = (level: number, segment: number) => {
  return useQuery({
    queryKey: ['words', level, segment],
    queryFn: () => wordAPI.getWords(level, segment),
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを使用
  });
};

export const useWord = (id: string | null) => {
  return useQuery({
    queryKey: ['word', id],
    queryFn: () => wordAPI.getWord(id!),
    enabled: !!id,
  });
};

export const useWordTranslations = (wordId: string | null) => {
  return useQuery({
    queryKey: ['word-translations', wordId],
    queryFn: () => wordAPI.getTranslations(wordId!),
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
