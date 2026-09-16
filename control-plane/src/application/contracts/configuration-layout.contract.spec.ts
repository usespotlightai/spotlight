import {
  integrationFilesIn,
  linePath,
  sealedVaultIn,
  skillFile,
  stationPath,
} from '@application/contracts/configuration-layout.contract';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { describe, expect, it } from 'vitest';

const file = (path: string, text = 'version: 1') =>
  ConfigurationFile.of(path, text);

describe('the configuration layout', () => {
  it('keeps a line in a folder of its own, with a file for each station', () => {
    expect(linePath('delivery')).toBe('.spotlight/lines/delivery/line.yml');
    expect(stationPath('delivery', 'triage')).toBe(
      '.spotlight/lines/delivery/stations/triage.md',
    );
  });

  it('keeps a skill in a folder of its own', () => {
    expect(skillFile(SkillKey.of('our-migrations'))).toBe(
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
