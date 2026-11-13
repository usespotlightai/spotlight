import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { HarnessKeysDto } from '@runs/application/dto/harness-keys.dto';
import type { HarnessKeysQuery } from '@runs/application/queries/host.queries';
import type { HeldHarnessKeys } from '@runs/application/services/held-harness-keys.service';
import type { HostSecretFetchesPort } from '@secrets/application/ports/host-secret-fetches.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class HarnessKeysHandler implements QueryHandlerPort<
  HarnessKeysQuery,
  HarnessKeysDto
> {
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly harnessKeys: HeldHarnessKeys,
    private readonly fetches: HostSecretFetchesPort,
  ) {}

  async execute(query: HarnessKeysQuery): Promise<HarnessKeysDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        query.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const held = await this.harnessKeys.inWorkspace(
        authenticated.workspaceId,
      );
      const fetched = await this.fetches.sealedForHost({
        workspaceId: authenticated.workspaceId.value,
        secrets: held.map((each) => each.value),
        recipient: query.recipient,
      });

      return {
        outcome: 'fetched',
        bound: [...new Set(fetched.secrets.map((each) => each.host))].sort(),
        secrets: fetched.secrets,
        denied: fetched.denied,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
