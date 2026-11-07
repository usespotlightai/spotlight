import type {
  HookOnFailure,
  HookRequestOrigin,
} from '@integrations/domain/value-objects/hook.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_RESOURCES = Symbol('HOOK_RESOURCES');

export interface WrittenHookMatch {
  readonly tools: readonly string[];
  readonly lines: readonly string[];
  readonly stations: readonly string[];
  readonly repositories: readonly string[];
  readonly paths: readonly string[];
}

export interface WrittenHookRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly from: HookRequestOrigin | null;
}

export type WrittenHookStep =
  | {
      readonly name: string;
      readonly call: string;
      readonly with: Readonly<Record<string, unknown>>;
    }
  | { readonly name: string; readonly request: WrittenHookRequest };

export type WrittenHookSigning =
  | { readonly secretVersion: number }
  | { readonly oidc: { readonly audience: string } };

export interface WrittenHookDocument {
  readonly on: string;
  readonly match: WrittenHookMatch;
  readonly when: string | null;
  readonly vars: Readonly<Record<string, string>>;
  readonly steps: readonly WrittenHookStep[];
  readonly signing: WrittenHookSigning | null;
  readonly failure: HookOnFailure | null;
  readonly timeoutSeconds: number | null;
}

export interface HookRecord {
  readonly id: string;
  readonly teamId: TeamId;
  readonly key: string;
  readonly version: number;
  readonly written: WrittenHookDocument;
}

export interface HookResourcesPort {
  withId(id: string): Promise<HookRecord | null>;

  at(teamId: TeamId, key: string): Promise<HookRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly HookRecord[]>;
}
