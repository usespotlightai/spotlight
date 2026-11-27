import { HarnessKeysRegistry } from '@secrets/application/services/harness-keys-registry.service';
import { describe, expect, it } from 'vitest';

describe('HarnessKeysRegistry', () => {
  it('names each harness key that a registered source names, once', () => {
    const registry = new HarnessKeysRegistry();
    registry.register({ names: () => ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] });
    registry.register({ names: () => ['OPENAI_API_KEY'] });

    expect(registry.names()).toEqual(['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']);
  });

  it('names no harness key before anything registers', () => {
    expect(new HarnessKeysRegistry().names()).toEqual([]);
  });
});
