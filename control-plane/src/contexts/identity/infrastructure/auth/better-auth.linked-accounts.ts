import type {
  LinkedAccountsPort,
  LinkedProvider,
} from '@identity/application/ports/linked-accounts.port';
import type { AppAuth } from '@identity/infrastructure/auth/auth';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class BetterAuthLinkedAccounts implements LinkedAccountsPort {
  constructor(private readonly auth: AppAuth) {}

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

      return accessToken || null;
    } catch {
      return null;
    }
  }
}
