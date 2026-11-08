import type { RunSpecShape } from '@runs/application/contracts/run-spec.contract';
import type { JsonValue } from '@shared-kernel/domain/json-value';

export interface RunPlacementContract {
  readonly labelGroups: readonly (readonly string[])[];
  readonly image: string | null;
}

export interface RunRefusalContract {
  readonly description: string;
}

type WorkingCopyRestores = 'always' | 'when-continuing';

export interface RunWorkingCopyContract {
  readonly key: string;
  readonly rejoinable: boolean;
  readonly restores: WorkingCopyRestores;
}

export interface RunRestoreContract {
  readonly archive: string;
}

export interface RunApiGrantContract {
  readonly actingFor: string;
  readonly scopes: readonly string[];
  readonly lifetimeMs: number;
}

export interface RunOrderContract {
  readonly runId: string;
  readonly workspaceId: string;
  readonly harness: string;
  readonly priority: number;
  readonly placement: RunPlacementContract;
  readonly spec: RunSpecShape;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
  readonly workingCopy: RunWorkingCopyContract | null;
  readonly restore: RunRestoreContract | null;
  readonly extensions: Readonly<Record<string, JsonValue>>;
  readonly apiGrant: RunApiGrantContract | null;
  readonly tags: Readonly<Record<string, string>>;
  readonly line: string | null;
  readonly refusal: readonly RunRefusalContract[] | null;
}

export const workingCopyKeyOf = (owner: string, name: string): string =>
  `${owner}/${name}`;

export interface RunRequesterContract {
  readonly owner: string;
  readonly kind: string;
  readonly id: string;
  readonly token: string | null;
  readonly team: string | null;
}

export interface RunPolicyContract {
  readonly holdsTurn: boolean;
  readonly gated: boolean;
  readonly actsBeyondItself: boolean;
  readonly asks: 'requester' | 'recorded';
  readonly listed: boolean;
  readonly exclusive: boolean;
}
