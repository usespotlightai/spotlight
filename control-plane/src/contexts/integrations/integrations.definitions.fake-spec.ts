import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

export const defined = (
  text: string,
  generated: { hash: string; tools: readonly string[] } | null = null,
): DefinedIntegration => {
  const definition = parseYaml(text);
  const compiled = compileIntegration(definition, expressions);
  const handWritten = compiled.ok
    ? compiled.readable.integration.tools.map((each) => each.tool)
    : [];

  return {
    id: `integration-${String(definition?.integration ?? '')}`,
    version: 1,
    integration: String(definition?.integration ?? ''),
    definition,
    tools: [...handWritten, ...(generated?.tools ?? [])],
    generatedFrom: generated?.hash ?? null,
    reading: null,
  };
};
