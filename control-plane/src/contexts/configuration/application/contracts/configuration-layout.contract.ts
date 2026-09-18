import { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';

export const KEPT_UNDER = '.spotlight';

export const INTEGRATIONS_UNDER = `${KEPT_UNDER}/integrations`;

export const SKILLS_UNDER = `${KEPT_UNDER}/skills`;

export const SECRETS_VAULT = `${KEPT_UNDER}/secrets.vault`;

export const CONFIGURATION_BRANCH = 'spotlight/configuration';

export const integrationPath = (source: string): string =>
  `${INTEGRATIONS_UNDER}/${source}.yml`;

export const skillFolder = (key: string): string => `${SKILLS_UNDER}/${key}`;

export const skillFile = (key: string): string =>
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
