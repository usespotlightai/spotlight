import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type SetEntriesDigest = string & {
  readonly brand: 'set-entries-digest';
};

const isSetEntriesDigest = (raw: string): raw is SetEntriesDigest =>
  SHA256_HEX.test(raw);

export const SetEntriesDigest = {
  of(raw: string): SetEntriesDigest {
    if (!isSetEntriesDigest(raw)) {
      throw new InvalidReplayCheckError(
        'the set entries digest must be a lowercase hex SHA-256',
      );
    }

    return raw;
  },
};
