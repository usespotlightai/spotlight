import { isDatedRelease } from '@runners/domain/services/release-order';

export const MIN_HOST_RELEASE = '20261002-02';

export const releaseHostsFollow = (release: string | null): string | null =>
  release !== null && isDatedRelease(release) ? release : null;
