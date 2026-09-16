import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';

export const KEPT_UNDER = '.spotlight';

export const INTEGRATIONS_UNDER = `${KEPT_UNDER}/integrations`;

export const LINES_UNDER = `${KEPT_UNDER}/lines`;

export const SKILLS_UNDER = `${KEPT_UNDER}/skills`;

export const SECRETS_VAULT = `${KEPT_UNDER}/secrets.vault`;

export const CONFIGURATION_BRANCH = 'spotlight/configuration';

export const LINE_FILE = 'line.yml';

export const STATIONS_UNDER = 'stations';

export const SKILL_FILE = 'SKILL.md';

export const lineFolder = (lineKey: string): string =>
  `${LINES_UNDER}/${lineKey}`;

export const linePath = (lineKey: string): string =>
  `${lineFolder(lineKey)}/${LINE_FILE}`;

export const stationsFolder = (lineKey: string): string =>
  `${lineFolder(lineKey)}/${STATIONS_UNDER}`;

export const stationPath = (lineKey: string, stationKey: string): string =>
  `${stationsFolder(lineKey)}/${stationKey}.md`;

export const integrationPath = (source: string): string =>
  `${INTEGRATIONS_UNDER}/${source}.yml`;

export const skillFolder = (key: SkillKey): string =>
  `${SKILLS_UNDER}/${key.value}`;

export const skillFile = (key: SkillKey): string =>
  `${skillFolder(key)}/${SKILL_FILE}`;

export const integrationFilesIn = (
  files: readonly ConfigurationFile[],
): readonly ConfigurationFile[] =>
  files.filter(
    (each) => each.isUnder(INTEGRATIONS_UNDER) && /\.ya?ml$/.test(each.path),
  );

export const sealedVaultIn = (
  files: readonly ConfigurationFile[],
): SealedVault | null => {
  const file = files.find((each) => each.path === SECRETS_VAULT);

  return file ? SealedVault.of(file.text) : null;
};
