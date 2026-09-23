import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { KnownIntegrations } from '@integrations/infrastructure/integrations/known-integrations';
import { describe, expect, it } from 'vitest';

describe('the starter files Spotlight writes', () => {
  const tools = new KnownIntegrations();

  for (const tool of tools.all()) {
    it(`compiles the one for ${tool.source} with nothing wrong`, () => {
      const read = compileIntegration(
        `.spotlight/integrations/${tool.source}.yml`,
        tools.fileFor(tool.source) as string,
      );

      expect(read.ok).toBe(true);
      expect(read.ok && read.readable.integration.source.value).toBe(
        tool.source,
      );
      expect(
        read.ok && read.readable.integration.declares.length,
      ).toBeGreaterThan(0);
    });

    it(`reads only what is there, in the one for ${tool.source}`, () => {
      const read = compileIntegration(
        `.spotlight/integrations/${tool.source}.yml`,
        tools.fileFor(tool.source) as string,
      );

      expect(
        read.ok
          ? read.warnings.map((each) => `${each.at}: ${each.reason}`)
          : [],
      ).toEqual([]);
    });
  }
});
