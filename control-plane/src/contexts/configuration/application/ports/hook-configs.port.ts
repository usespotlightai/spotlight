import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_CONFIGS = Symbol('HOOK_CONFIGS');

export interface HookConfigMatch {
  readonly tools: readonly string[];
  readonly lines: readonly string[];
  readonly stations: readonly string[];
  readonly repositories: readonly string[];
  readonly paths: readonly string[];
}

interface HookConfigRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly from: 'spotlight' | 'network';
}

export type HookConfigStep =
  | {
      readonly name: string;
      readonly call: string;
      readonly with: Readonly<Record<string, unknown>>;
    }
  | {
      readonly name: string;
      readonly request: HookConfigRequest;
    };

export type HookConfigSigning =
  | { readonly secretVersion: number }
  | { readonly oidc: { readonly audience: string } };

export interface HookConfig {
  readonly id: string;
  readonly address: string;
  readonly teamId: TeamId;
  readonly key: string;
  readonly on: string;
  readonly match: HookConfigMatch;
  readonly when: string | null;
  readonly vars: Readonly<Record<string, string>>;
  readonly steps: readonly HookConfigStep[];
  readonly signing: HookConfigSigning | null;
  readonly failure: string | null;
  readonly timeoutSeconds: number | null;
}

export interface HookConfigsPort {
  withId(id: string): Promise<HookConfig | null>;

  ofTeam(teamId: TeamId): Promise<readonly HookConfig[]>;
}
