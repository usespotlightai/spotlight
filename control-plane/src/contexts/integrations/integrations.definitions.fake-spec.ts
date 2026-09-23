import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { parse as parseYaml } from 'yaml';

export const defined = (text: string): DefinedIntegration => {
  const definition = parseYaml(text);

  return { source: String(definition?.integration ?? ''), definition };
};
