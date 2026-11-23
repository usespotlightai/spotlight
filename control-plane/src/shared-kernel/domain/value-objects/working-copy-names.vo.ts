// The name of a store that the hosts' working copy hook keeps working copies in, such as s3://team-a.
// Spotlight does not read it: two pools or trusts with the same name share their working copies.
const STORE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;

const MOST_STORE = 512;

// The name of a snapshot in a store, such as the base that new working copies start from.
const SNAPSHOT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const WorkingCopyStoreName = {
  MOST: MOST_STORE,

  isWellFormed(raw: string): boolean {
    return raw.length <= MOST_STORE && STORE.test(raw);
  },
};

export const SnapshotName = {
  isWellFormed(raw: string): boolean {
    return SNAPSHOT.test(raw);
  },
};
