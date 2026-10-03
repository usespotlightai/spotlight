import type { HarnessResponseDto } from '@/lib/api';

export const DEFAULT_CHOICE = '__default';

export const capitalized = (word: string): string =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

export const chosen = (next: unknown): string =>
  String(next) === DEFAULT_CHOICE ? '' : String(next);

export const agentName = (
  offered: HarnessResponseDto | undefined,
  model: string,
  effort: string,
): string => {
  const modelName = offered?.models.find((each) => each.id === model)?.name;
  const efforts = offered?.efforts ?? [];
  const shownEffort = efforts.length > 0 && effort ? capitalized(effort) : '';

  return [offered?.name ?? 'Nobody', modelName, shownEffort]
    .filter(Boolean)
    .join(' ');
};
