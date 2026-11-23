import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export interface ChangedHook {
  readonly key: string;
  readonly lines: readonly string[];
  readonly stations: readonly string[];
}

export interface ChangedIntegration {
  readonly key: string;
  readonly definition: Readonly<Record<string, unknown>> | null;
}

export interface ChangedResources {
  readonly secrets?: readonly string[];
  readonly skills?: readonly string[];
  readonly harnessProfiles?: readonly string[];
  readonly integrations?: readonly ChangedIntegration[];
  readonly hooks?: readonly ChangedHook[];
}

export interface CheckedChange {
  readonly lineId: string;
  readonly stationKey: string;
  readonly station: unknown;
  readonly line?: unknown;
  readonly changed: ChangedResources;
  readonly reference: {
    readonly commit: string | null;
    readonly pullRequest: number | null;
  };
}

export class StartReplayCheckCommand {
  constructor(
    readonly teamId: string,
    readonly change: CheckedChange,
    readonly repeats: number,
    readonly actor: Actor,
    readonly idempotencyKey: string,
  ) {}
}
