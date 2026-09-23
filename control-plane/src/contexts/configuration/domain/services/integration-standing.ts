export const INTEGRATION_STANDINGS = ['listens', 'unlinked', 'linked'] as const;

export type IntegrationStanding = (typeof INTEGRATION_STANDINGS)[number];

export const standingOf = (
  connectable: boolean,
  linked: boolean,
): IntegrationStanding => {
  if (!connectable) {
    return 'listens';
  }

  return linked ? 'linked' : 'unlinked';
};
