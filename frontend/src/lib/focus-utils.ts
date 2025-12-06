export const FOCUS_MAX_LIMIT = 100;

export const buildNumberOptions = (min: number, max: number, step: number) => {
  const list: number[] = [];
  for (let v = min; v <= max; v += step) {
    list.push(v);
  }
  if (list[list.length - 1] !== max) list.push(max);
  return Array.from(new Set(list)).sort((a, b) => a - b);
};

export const buildFocusQuestionOptions = (availableCount: number) => {
  const capped = Math.max(0, Math.min(availableCount, FOCUS_MAX_LIMIT));
  if (capped === 0) return [];
  const min = capped >= 10 ? 10 : 1;
  const step = capped >= 10 ? 5 : 1;
  return buildNumberOptions(min, capped, step);
};
