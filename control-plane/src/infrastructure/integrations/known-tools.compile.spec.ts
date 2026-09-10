import { compileIntegration } from '@infrastructure/integrations/integration.compile';
import { KnownTools } from '@infrastructure/integrations/known-tools';
import { describe, expect, it } from 'vitest';

// The starter files Spotlight writes when a team chooses a tool must compile
// against the current schema — otherwise choosing one writes config that never
// listens, which is exactly what happened when the schema moved to the IR and
// the templates did not follow.
describe('the starter files Spotlight writes', () => {
  const tools = new KnownTools();

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
  }
});
