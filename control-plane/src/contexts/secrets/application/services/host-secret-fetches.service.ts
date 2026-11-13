import type { FetchedSecrets } from '@secrets/application/contracts/run-secret-fetch.contract';
import type {
  HostSecretFetch,
  HostSecretFetchesPort,
} from '@secrets/application/ports/host-secret-fetches.port';
import type { SealedSecrets } from '@secrets/application/services/sealed-secrets';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const NO_RUN = '';

export class HostSecretFetches implements HostSecretFetchesPort {
  constructor(
    private readonly sealed: SealedSecrets,
    private readonly logger: LoggerPort,
  ) {}

  async sealedForHost(request: HostSecretFetch): Promise<FetchedSecrets> {
    const { secrets, denied } = await this.sealed.of({
      workspaceId: request.workspaceId,
      secrets: request.secrets,
      recipient: request.recipient,
      subject: NO_RUN,
    });

    this.logger.info(
      {
        workspaceId: request.workspaceId,
        fetched: [...new Set(secrets.map((each) => each.secret))],
        denied: denied.map((each) => each.secret),
      },
      'sealed secrets to a host of the workspace',
    );

    return { secrets, denied };
  }
}
