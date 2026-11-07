import type {
  WrittenHookMatch,
  WrittenHookSigning,
} from '@integrations/application/ports/hook-resources.port';
import type {
  HookOnFailure,
  HookRequestOrigin,
} from '@integrations/domain/value-objects/hook.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface HookRequestView {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly from: HookRequestOrigin;
}

export type HookStepView =
  | {
      readonly name: string;
      readonly call: string;
      readonly with: Readonly<Record<string, unknown>>;
    }
  | { readonly name: string; readonly request: HookRequestView };

export interface HookResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly key: string;
  readonly on: string;
  readonly match: WrittenHookMatch;
  readonly when: string | null;
  readonly vars: Readonly<Record<string, string>>;
  readonly steps: readonly HookStepView[];
  readonly signing: WrittenHookSigning | null;
  readonly failure: HookOnFailure;
  readonly timeoutSeconds: number;
  readonly warnings: readonly ConfigurationProblem[];
}
