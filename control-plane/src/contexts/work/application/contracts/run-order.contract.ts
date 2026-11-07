import type { RunSpecShape } from '@work/application/contracts/run-spec.contract';

export type RunOrderSubjectContract =
  | {
      readonly kind: 'task';
      readonly taskId: string;
      readonly stationId: string | null;
      readonly revision: number;
    }
  | { readonly kind: 'chat'; readonly chatId: string }
  | {
      readonly kind: 'replay';
      readonly replayOf: string;
      readonly taskId: string;
      readonly stationId: string;
      readonly teamId: string;
    }
  | {
      readonly kind: 'search';
      readonly searchId: string;
      readonly iteration: number;
      readonly stationId: string | null;
      readonly teamId: string;
    };

export interface RunPlacementContract {
  readonly labelGroups: readonly (readonly string[])[];
  readonly image: string | null;
}

export interface RunRefusalContract {
  readonly description: string;
}

export interface RunOrderContract {
  readonly runId: string;
  readonly workspaceId: string;
  readonly harness: string;
  readonly priority: number;
  readonly placement: RunPlacementContract;
  readonly spec: RunSpecShape;
  readonly subject: RunOrderSubjectContract | null;
  readonly team: string | null;
  readonly refusal: readonly RunRefusalContract[] | null;
}

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
