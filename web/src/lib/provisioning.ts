import type { WorkspaceResponseDto } from '@/lib/api';

const PENDING_POLL_MS = 1_000;

const openedHere = new Set<string>();

export const provisioningPollFor = (
  provisioning: WorkspaceResponseDto['provisioning'] | undefined,
): number | false => (provisioning === 'pending' ? PENDING_POLL_MS : false);

export const markOpenedHere = (slug: string): void => {
  openedHere.add(slug);
};

export const wasOpenedHere = (slug: string | undefined): boolean =>
  slug !== undefined && openedHere.has(slug);

export const forgetOpenedHere = (slug: string | undefined): void => {
  if (slug !== undefined) {
    openedHere.delete(slug);
  }
};
