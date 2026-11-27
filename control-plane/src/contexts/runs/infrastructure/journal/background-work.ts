import { decoded } from '@runs/infrastructure/journal/journalled';

const WAIT_ENDINGS = [
  'settled',
  'handed-over',
  'message',
  'stopped',
  'gone',
  'limit',
] as const;

export type WaitEnded = (typeof WAIT_ENDINGS)[number];

export interface BackgroundWork {
  readonly tasks: readonly string[];
  readonly ended: WaitEnded | null;
}

const isWaitEnded = (value: unknown): value is WaitEnded =>
  (WAIT_ENDINGS as readonly unknown[]).includes(value);

interface SentTask {
  readonly description?: unknown;
  readonly kind?: unknown;
}

interface SentWork {
  readonly tasks?: unknown;
  readonly ended?: unknown;
}

const named = (task: unknown): string => {
  if (typeof task !== 'object' || task === null) {
    return '';
  }
  const { description, kind }: SentTask = task;
  if (typeof description === 'string' && description.trim()) {
    return description.trim();
  }
  return typeof kind === 'string' ? kind : '';
};

export const backgroundWorkIn = (data: string | null): BackgroundWork => {
  try {
    const parsed: unknown = JSON.parse(decoded(data ?? ''));
    const { tasks, ended }: SentWork =
      typeof parsed === 'object' && parsed !== null ? parsed : {};
    return {
      tasks: Array.isArray(tasks) ? tasks.map(named).filter(Boolean) : [],
      ended: isWaitEnded(ended) ? ended : null,
    };
  } catch {
    return { tasks: [], ended: null };
  }
};
