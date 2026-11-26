import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { CatalogueHarnessKeys } from '@runs/application/services/catalogue-harness-keys.service';
import { describe, expect, it } from 'vitest';

describe('CatalogueHarnessKeys', () => {
  it('names the keys of every harness in the catalogue', () => {
    const launch = {
      catalogue: () => [
        { id: 'claude-code', harnessKeys: ['ANTHROPIC_API_KEY'] },
        { id: 'codex', harnessKeys: ['OPENAI_API_KEY'] },
      ],
    } as unknown as HarnessLaunchPort;

    expect(new CatalogueHarnessKeys(launch).names()).toEqual([
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
    ]);
  });
});
