import type { JsonValue } from '@shared-kernel/domain/json-value';
import type { RunSpecShape } from '@work/application/contracts/run-spec.contract';

export interface RunPlacementContract {
  readonly labelGroups: readonly (readonly string[])[];
  readonly image: string | null;
}

export interface RunRefusalContract {
  readonly description: string;
}

export type WorkspaceRestores = 'always' | 'when-continuing';

export interface RunWorkspaceContract {
  readonly key: string;
  readonly rejoinable: boolean;
  readonly restores: WorkspaceRestores;
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
  readonly workspace: RunWorkspaceContract | null;
  readonly restore: RunRestoreContract | null;
  readonly extensions: Readonly<Record<string, JsonValue>>;
  readonly apiGrant: RunApiGrantContract | null;
  readonly tags: Readonly<Record<string, string>>;
  readonly refusal: readonly RunRefusalContract[] | null;
}

export const workspaceKeyOf = (owner: string, name: string): string =>
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

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, each]) => each !== undefined)
        .sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
        .map(([key, each]) => [key, canonical(each)]),
    );
  }

  return value;
};

export const canonicalOrder = (order: RunOrderContract): string =>
  JSON.stringify(canonical(order));
