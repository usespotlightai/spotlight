import { randomBytes } from 'node:crypto';
import { armor, Decrypter, Encrypter } from 'age-encryption';
import { parse, stringify } from 'yaml';

export type Secrets = Readonly<Record<string, string>>;

export const WORK_FACTOR = 10;

export const NOT_AGE = 'is not an ASCII-armored age file';
export const NOT_FOR_THIS_KEY = 'does not open with the vault key';
export const NOT_SECRETS =
  'does not hold a map of secret names to their values';

const WRONG_KEY = "no identity matched any of the file's recipients";

type VaultErrorReason =
  | 'not-age'
  | 'not-for-this-key'
  | 'undecryptable'
  | 'not-secrets';

const SAID: Readonly<Record<VaultErrorReason, string>> = {
  'not-age': NOT_AGE,
  'not-for-this-key': NOT_FOR_THIS_KEY,
  undecryptable: 'could not be decrypted',
  'not-secrets': NOT_SECRETS,
};

export class VaultError extends Error {
  constructor(
    readonly reason: VaultErrorReason,
    detail?: string,
  ) {
    super(detail ? `${SAID[reason]}: ${detail}` : SAID[reason]);
    this.name = 'VaultError';
  }
}

export const newVaultKey = (): string => randomBytes(32).toString('base64url');

const secretsOf = (text: string): Secrets => {
  let read: unknown;

  try {
    read = parse(text, { schema: 'failsafe' });
  } catch {
    throw new VaultError('not-secrets');
  }

  if (!read || typeof read !== 'object' || Array.isArray(read)) {
    throw new VaultError('not-secrets');
  }

  const entries = Object.entries(read);

  if (!entries.every(([, value]) => typeof value === 'string')) {
    throw new VaultError('not-secrets');
  }

  return Object.fromEntries(entries) as Secrets;
};

export const openVault = async (
  vault: string,
  key: string,
): Promise<Secrets> => {
  let sealed: Uint8Array;

  try {
    sealed = armor.decode(vault);
  } catch {
    throw new VaultError('not-age');
  }

  const decrypter = new Decrypter();
  decrypter.addPassphrase(key);

  let text: string;

  try {
    text = await decrypter.decrypt(sealed, 'text');
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);

    throw said === WRONG_KEY
      ? new VaultError('not-for-this-key')
      : new VaultError('undecryptable', said);
  }

  return secretsOf(text);
};

export const sealVault = async (
  secrets: Secrets,
  key: string,
  workFactor: number = WORK_FACTOR,
): Promise<string> => {
  const names = Object.keys(secrets).sort();
  const encrypter = new Encrypter();
  encrypter.setPassphrase(key);
  encrypter.setScryptWorkFactor(workFactor);

  const plain = Object.fromEntries(names.map((name) => [name, secrets[name]]));

  return armor.encode(
    await encrypter.encrypt(stringify(plain, { lineWidth: 0 })),
  );
};
