import type {
  HookCompilerPort,
  ParsedHookDefinition,
} from '@integrations/application/ports/hook-compiler.port';
import {
  compileHook,
  secretIn,
} from '@integrations/infrastructure/hooks/hook.compile';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';

export class HookCompiler implements HookCompilerPort {
  constructor(private readonly expressions: ExpressionEnginePort) {}

  compile(raw: unknown): ParsedHookDefinition {
    const compiled = compileHook(raw, this.expressions);

    return compiled.ok
      ? {
          ok: true,
          hook: compiled.ir.hook,
          document: compiled.document,
          secret: secretIn(raw),
        }
      : compiled;
  }
}
