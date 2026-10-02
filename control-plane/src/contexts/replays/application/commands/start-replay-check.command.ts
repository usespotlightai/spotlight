import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export interface CheckedChange {
  readonly lineId: string;
  readonly stationKey: string;
  readonly station: unknown;
  readonly line?: unknown;
  readonly reference: {
    readonly commit: string | null;
    readonly pullRequest: number | null;
  };
}

export class StartReplayCheckCommand {
  constructor(
    readonly teamId: string,
    readonly change: CheckedChange,
    readonly actor: Actor,
    readonly idempotencyKey: string,
  ) {}
}
