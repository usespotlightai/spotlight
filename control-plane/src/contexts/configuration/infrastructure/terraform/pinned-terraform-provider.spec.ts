import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PinnedTerraformProvider } from '@configuration/infrastructure/terraform/pinned-terraform-provider';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';
import { describe, expect, it } from 'vitest';

const PIN = readFileSync(join(__dirname, 'provider.tf'), 'utf8');

describe('PinnedTerraformProvider', () => {
  it('requires the release that provider.tf pins, which Dependabot keeps current', () => {
    const provider = new PinnedTerraformProvider();

    expect(provider.source).toBe('usespotlightai/spotlight');
    expect(PIN).toContain(`version = "${provider.version}"`);
    expect(
      Release.of(`v${provider.version}`).isOlderThan(
        Release.of('v0.1.0-rc.11'),
      ),
    ).toBe(false);
  });

  it('refuses a pin with no version', () => {
    expect(
      () =>
        new PinnedTerraformProvider(
          'terraform {\n  required_providers {\n    spotlight = {\n      source = "usespotlightai/spotlight"\n    }\n  }\n}\n',
        ),
    ).toThrow(/has no version/);
  });
});
