export const SECRET_SANDBOXES = ['stand-in', 'env'] as const;

export type SecretSandbox = (typeof SECRET_SANDBOXES)[number];

export const SHORTEST_SANDBOX_VALUE = 8;

export const allowsSandboxes = (sandbox: SecretSandbox): boolean =>
  sandbox === 'env';
