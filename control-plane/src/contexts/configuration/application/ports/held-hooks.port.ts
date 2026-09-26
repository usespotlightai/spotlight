import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HELD_HOOKS = Symbol('HELD_HOOKS');

export interface HeldHookMatch {
  readonly tools: readonly string[];
  readonly lines: readonly string[];
  readonly stations: readonly string[];
  readonly repositories: readonly string[];
  readonly paths: readonly string[];
}

interface HeldHookRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly from: 'spotlight' | 'network';
}

export type HeldHookStep =
  | {
      readonly name: string;
      readonly call: string;
      readonly with: Readonly<Record<string, unknown>>;
    }
  | {
      readonly name: string;
      readonly request: HeldHookRequest;
    };

export type HeldHookSigning =
  | { readonly secretVersion: number }
  | { readonly oidc: { readonly audience: string } };

export interface HeldHook {
  readonly id: string;
  readonly address: string;
  readonly teamId: TeamId;
  readonly key: string;
  readonly on: string;
  readonly match: HeldHookMatch;
  readonly when: string | null;
  readonly vars: Readonly<Record<string, string>>;
  readonly steps: readonly HeldHookStep[];
  readonly signing: HeldHookSigning | null;
  readonly failure: string;
  readonly timeoutSeconds: number;
}

export interface HeldHooksPort {
  withId(id: string): Promise<HeldHook | null>;

  ofTeam(teamId: TeamId): Promise<readonly HeldHook[]>;
}
