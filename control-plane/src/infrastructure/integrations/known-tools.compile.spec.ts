import { KNOWN_TOOLS } from '@domain/services/known-tools';
import { compileIntegration } from '@infrastructure/integrations/integration.compile';
import { describe, expect, it } from 'vitest';

// The starter files Spotlight writes when a team chooses a tool must compile
// against the current schema — otherwise choosing one writes config that never
// listens, which is exactly what happened when the schema moved to the IR and
// the templates did not follow.
describe('the starter files Spotlight writes', () => {
  for (const tool of KNOWN_TOOLS) {
    it(`compiles the one for ${tool.source.value} with nothing wrong`, () => {
      const read = compileIntegration(
        `.spotlight/integrations/${tool.source.value}.yml`,
        tool.file,
      );

      expect(read.ok).toBe(true);
      expect(read.ok && read.readable.integration.source.value).toBe(
        tool.source.value,
      );
      expect(
        read.ok && read.readable.integration.declares.length,
      ).toBeGreaterThan(0);
    });
  }
});
