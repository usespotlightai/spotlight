export const toBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

export const fromTyped = (typed: string): string => {
  const bytes = new TextEncoder().encode(typed);

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

export type RunEvent = {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly message?: string;
  readonly data?: string;
  readonly offset?: number;
};

export const isRunEvent = (value: unknown): value is RunEvent =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RunEvent).seq === 'number' &&
  typeof (value as RunEvent).type === 'string';
