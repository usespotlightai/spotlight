import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const mappingOf = (text: string): Readonly<Record<string, unknown>> => {
  const definition: unknown = parseYaml(text);

  if (!isRecord(definition)) {
    throw new Error('expected a YAML mapping');
  }

  return definition;
};

export const defined = (
  text: string,
  generated: { hash: string; tools: readonly string[] } | null = null,
): DefinedIntegration => {
  const definition = mappingOf(text);
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
