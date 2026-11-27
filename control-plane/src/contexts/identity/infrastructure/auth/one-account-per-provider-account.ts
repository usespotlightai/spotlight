import type { BetterAuthPlugin } from 'better-auth';

const providerAccountIndex = () =>
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

export const oneAccountPerProviderAccount: typeof providerAccountIndex =
  providerAccountIndex;
