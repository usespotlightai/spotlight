import {
  integrationFilesIn,
  sealedVaultIn,
  skillFile,
} from '@configuration/application/contracts/configuration-layout.contract';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { describe, expect, it } from 'vitest';

const file = (path: string, text = 'version: 1') =>
  ConfigurationFile.of(path, text);

describe('the configuration layout', () => {
  it('keeps a skill in a folder of its own', () => {
    expect(skillFile('our-migrations')).toBe(
      '.spotlight/skills/our-migrations/SKILL.md',
    );
  });

  it('finds the integration files, written in YAML', () => {
    expect(
      integrationFilesIn([
        file('.spotlight/integrations/linear.yml'),
        file('.spotlight/integrations/sentry.yaml'),
        file('.spotlight/integrations/notes.txt'),
        file('.spotlight/lines/delivery/line.yml'),
      ]).map((each) => each.path),
    ).toEqual([
      '.spotlight/integrations/linear.yml',
      '.spotlight/integrations/sentry.yaml',
    ]);
  });

  it('finds the sealed vault, where there is one', () => {
    expect(
      sealedVaultIn([file('.spotlight/secrets.vault', 'sealed')])?.text,
    ).toBe('sealed');
    expect(sealedVaultIn([file('.spotlight/lines/delivery/line.yml')])).toBe(
      null,
    );
  });
});
