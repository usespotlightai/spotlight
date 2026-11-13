import type { FetchedSecrets } from '@secrets/application/contracts/run-secret-fetch.contract';
import type {
  CallSecretFetch,
  CallSecretFetchesPort,
} from '@secrets/application/ports/call-secret-fetches.port';
import type { SealedSecrets } from '@secrets/application/services/sealed-secrets';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class CallSecretFetches implements CallSecretFetchesPort {
  constructor(
    private readonly sealed: SealedSecrets,
    private readonly logger: LoggerPort,
  ) {}

  async sealedForCall(request: CallSecretFetch): Promise<FetchedSecrets> {
    const { secrets, denied } = await this.sealed.of({
      workspaceId: request.workspaceId,
      secrets: request.secrets,
      recipient: request.recipient,
      subject: request.callId,
    });

    this.logger.info(
      {
        workspaceId: request.workspaceId,
        callId: request.callId,
        fetched: [...new Set(secrets.map((each) => each.secret))],
        denied: denied.map((each) => each.secret),
      },
      'sealed the secrets of a network call to its egress',
    );

    return { secrets, denied };
  }
}
