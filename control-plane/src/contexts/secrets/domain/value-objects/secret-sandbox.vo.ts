export const SECRET_SANDBOXES = ['stand-in', 'env'] as const;

export type SecretSandbox = (typeof SECRET_SANDBOXES)[number];

export const DEFAULT_SECRET_SANDBOX: SecretSandbox = 'stand-in';

export const SANDBOX_VALUE_MIN_LENGTH = 8;

export const sandboxValueRule = (name: string): string =>
  `must have at least ${SANDBOX_VALUE_MIN_LENGTH} characters that are not whitespace, and no NUL byte, since a run gets ${name} in its sandbox`;

export const allowsSandbox = (sandbox: SecretSandbox): boolean =>
  sandbox === 'env';
