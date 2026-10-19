import { isSemverRelease } from '@runners/domain/services/release-order';

export const MIN_HOST_RELEASE = 'v0.1.0-rc.1';

export const releaseHostsFollow = (release: string | null): string | null =>
  release !== null && isSemverRelease(release) ? release : null;
