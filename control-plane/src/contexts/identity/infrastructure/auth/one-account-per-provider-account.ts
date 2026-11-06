import type { BetterAuthPlugin } from 'better-auth';

export const oneAccountPerProviderAccount = () =>
  ({
    id: 'one-account-per-provider-account',
    schema: {
      account: {
        fields: {},
        indexes: [
          {
            name: 'account_provider_account_uidx',
            fields: ['providerId', 'accountId'],
            unique: true,
          },
        ],
      },
    },
  }) satisfies BetterAuthPlugin;
