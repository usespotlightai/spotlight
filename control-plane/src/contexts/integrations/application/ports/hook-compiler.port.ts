import type { Hook } from '@integrations/domain/entities/hook.entity';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const HOOK_COMPILER = Symbol('HOOK_COMPILER');

export interface GivenSigningSecret {
  readonly secret: string | null;
  readonly version: number;
}

export type ParsedHookDefinition =
  | {
      readonly ok: true;
      readonly hook: Hook;
      readonly document: DefinitionDocument;
      readonly secret: GivenSigningSecret | null;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface HookCompilerPort {
  compile(raw: unknown): ParsedHookDefinition;
}
