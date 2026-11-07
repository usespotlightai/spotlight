export const SECRET_LOCATIONS = ['header', 'query'] as const;

export type SecretLocation = (typeof SECRET_LOCATIONS)[number];
