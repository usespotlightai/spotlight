import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

export const defined = (
  text: string,
  generated: { hash: string; tools: readonly string[] } | null = null,
): DefinedIntegration => {
  const definition = parseYaml(text) as Record<string, unknown>;
  const compiled = compileIntegration(definition, expressions, null);
  const handWritten = compiled.ok
    ? compiled.readable.integration.writtenTools.map((each) => each.tool.value)
    : [];

  const integration =
    typeof definition.integration === 'string' ? definition.integration : '';

  return {
    id: `integration-${integration}`,
    version: 1,
    integration,
    definition,
    tools: [...handWritten, ...(generated?.tools ?? [])],
    generatedFrom: generated?.hash ?? null,
    reading: null,
  };
};
