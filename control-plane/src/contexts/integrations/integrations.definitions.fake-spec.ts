import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

export const defined = (
  text: string,
  generated: { hash: string; offers: readonly string[] } | null = null,
): DefinedIntegration => {
  const definition = parseYaml(text);
  const compiled = compileIntegration(definition, expressions);
  const handWritten = compiled.ok
    ? compiled.readable.integration.offers.map((each) => each.tool)
    : [];

  return {
    id: `integration-${String(definition?.integration ?? '')}`,
    version: 1,
    source: String(definition?.integration ?? ''),
    definition,
    offers: [...handWritten, ...(generated?.offers ?? [])],
    generatedFrom: generated?.hash ?? null,
    reading: null,
  };
};
