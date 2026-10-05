export const SECRET_CARRIERS = ['header', 'query'] as const;

export type SecretCarrierKind = (typeof SECRET_CARRIERS)[number];
