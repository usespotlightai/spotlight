import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { describe, expect, it } from 'vitest';

describe('ConfigurationFile', () => {
  it('holds where it is and what it says', () => {
    const file = ConfigurationFile.of(
      '.spotlight/lines/default/line.yml',
      'a: 1',
    );

    expect(file.path).toBe('.spotlight/lines/default/line.yml');
    expect(file.text).toBe('a: 1');
  });

  it('says whether it sits beneath a directory, however deep', () => {
    const file = ConfigurationFile.of('.spotlight/lines/team/a.yml', '');

    expect(file.isUnder('.spotlight')).toBe(true);
    expect(file.isUnder('.spotlight/lines')).toBe(true);
    expect(file.isUnder('.spotlight/lines/')).toBe(true);
    expect(file.isUnder('.spotlight/integrations')).toBe(false);
  });

  it('is not under a directory that only reads like one', () => {
    expect(
      ConfigurationFile.of('.spotlightly/a.yml', '').isUnder('.spotlight'),
    ).toBe(false);
  });

  it('says whether it is written in YAML', () => {
    expect(ConfigurationFile.of('a.yml', '').isYaml).toBe(true);
    expect(ConfigurationFile.of('a.yaml', '').isYaml).toBe(true);
    expect(ConfigurationFile.of('a.txt', '').isYaml).toBe(false);
  });

  it('refuses a path that is not within the repository', () => {
    for (const path of [
      '/etc/passwd',
      '../secrets.vault',
      '.spotlight/../../x',
    ]) {
      expect(() => ConfigurationFile.of(path, '')).toThrow(
        InvalidIdentifierError,
      );
    }
  });

  it('is the same file as another at the same path saying the same', () => {
    expect(
      ConfigurationFile.of('a.yml', 'x').equals(
        ConfigurationFile.of('a.yml', 'x'),
      ),
    ).toBe(true);
    expect(
      ConfigurationFile.of('a.yml', 'x').equals(
        ConfigurationFile.of('a.yml', 'y'),
      ),
    ).toBe(false);
  });
});
