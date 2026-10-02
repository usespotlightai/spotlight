import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';

type Planned<T> = T | Forbidden;

export type SetOpened = Planned<{
  readonly outcome: 'opened';
  readonly id: string;
}>;

export type SetChanged = Planned<{ readonly outcome: 'changed' }>;

export type SetDeleted = Planned<{ readonly outcome: 'deleted' }>;

interface StartedSpend {
  readonly amount: number;
  readonly currency: string;
}

export type ReplayStarted = Planned<{
  readonly outcome: 'started';
  readonly id: string;
  readonly ceiling: StartedSpend;
  readonly baseline: {
    readonly id: string;
    readonly ceiling: StartedSpend;
    readonly status: 'started' | 'starting';
  } | null;
}>;

export type ReplayStoppedOutcome = Planned<{ readonly outcome: 'stopped' }>;
