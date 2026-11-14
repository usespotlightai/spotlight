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

const named = (task: unknown): string => {
  if (typeof task !== 'object' || task === null) {
    return '';
  }
  const { description, kind } = task as Record<string, unknown>;
  if (typeof description === 'string' && description.trim()) {
    return description.trim();
  }
  return typeof kind === 'string' ? kind : '';
};

export const backgroundWorkIn = (data: string | null): BackgroundWork => {
  try {
    const parsed: unknown = JSON.parse(decoded(data ?? ''));
    const { tasks, ended } =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    return {
      tasks: Array.isArray(tasks) ? tasks.map(named).filter(Boolean) : [],
      ended: isWaitEnded(ended) ? ended : null,
    };
  } catch {
    return { tasks: [], ended: null };
  }
};
