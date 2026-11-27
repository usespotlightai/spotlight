import type {
  LinkedAccountsPort,
  LinkedProvider,
} from '@identity/application/ports/linked-accounts.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { OncePer } from '@shared-kernel/application/services/once-per';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const FAILED_FOR_MS = 10 * 60_000;

export interface LinkedAccountsAuth {
  readonly $context: Promise<{
    readonly internalAdapter: {
      findAccounts(
        userId: string,
      ): Promise<
        readonly { readonly id: string; readonly providerId: string }[]
      >;
    };
  }>;
  readonly api: {
    getAccessToken(request: {
      body: { accountId: string; userId: string };
    }): Promise<{ readonly accessToken?: string }>;
  };
}

export class BetterAuthLinkedAccounts implements LinkedAccountsPort {
  readonly #failed = new OncePer(FAILED_FOR_MS);

  constructor(
    private readonly auth: LinkedAccountsAuth,
    private readonly logger: LoggerPort,
  ) {}

  async tokenFor(
    userId: UserId,
    provider: LinkedProvider,
  ): Promise<string | null> {
    const context = await this.auth.$context;
    const linked = (
      await context.internalAdapter.findAccounts(userId.value)
    ).find((each) => each.providerId === provider);

    if (!linked) {
      return null;
    }

    try {
      const { accessToken } = await this.auth.api.getAccessToken({
        body: { accountId: linked.id, userId: userId.value },
      });

      return accessToken !== undefined && accessToken !== ''
        ? accessToken
        : null;
    } catch (error) {
      if (this.#failed.due(`${userId.value}\n${provider}`, new Date())) {
        this.logger.warn(
          {
            userId: userId.value,
            provider,
            error: error instanceof Error ? error.name : 'unknown',
          },
          'Could not read the access token of a linked account',
        );
      }
      return null;
    }
  }
}
