import { integrationPath } from '@application/contracts/configuration-layout.contract';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { StarterIntegrationsPort } from '@application/ports/starter-integrations.port';
import { distinct } from '@domain/services/distinct';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { SecretName } from '@domain/value-objects/secret-name.vo';

export const starterSecrets = (
  starters: StarterIntegrationsPort,
  integrations: IntegrationReaderPort,
  source: string,
): readonly SecretName[] => {
  const file = starters.fileFor(source);

  if (!file) {
    return [];
  }

  return distinct(
    integrations
      .read([ConfigurationFile.of(integrationPath(source), file)])
      .integrations.flatMap((each) => each.credentials),
  );
};
