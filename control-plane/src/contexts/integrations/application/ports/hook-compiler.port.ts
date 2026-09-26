import type { Hook } from '@integrations/domain/entities/hook.entity';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';

export const HOOK_COMPILER = Symbol('HOOK_COMPILER');

export interface GivenSigningSecret {
  readonly secret: string | null;
  readonly version: number;
}

export type CompiledHookDefinition =
  | {
      readonly ok: true;
      readonly hook: Hook;
      readonly document: DefinitionDocument;
      readonly secret: GivenSigningSecret | null;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface HookCompilerPort {
  compile(held: unknown): CompiledHookDefinition;
}
