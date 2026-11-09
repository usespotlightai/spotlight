const WAIT_ENDINGS = [
  'settled',
  'handed-over',
  'message',
  'stopped',
  'gone',
  'limit',
] as const;

export type WaitEnded = (typeof WAIT_ENDINGS)[number];

const BACKGROUND_KINDS = ['command', 'monitor', 'subagent', 'other'] as const;

type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

interface BackgroundTask {
  readonly id: string;
  readonly kind: BackgroundKind;
  readonly description: string;
}

export interface BackgroundWork {
  readonly tasks: readonly BackgroundTask[];
  readonly until?: string;
  readonly ended?: WaitEnded;
}

export const isWaitEnded = (value: unknown): value is WaitEnded =>
  (WAIT_ENDINGS as readonly unknown[]).includes(value);
