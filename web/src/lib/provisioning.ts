import type { WorkspaceResponseDto } from '@/lib/api';

const PENDING_POLL_MS = 1_000;

const createdHere = new Set<string>();

export const provisioningPollFor = (
  provisioning: WorkspaceResponseDto['provisioning'] | undefined,
): number | false => (provisioning === 'pending' ? PENDING_POLL_MS : false);

export const markCreatedHere = (slug: string): void => {
  createdHere.add(slug);
};

export const wasCreatedHere = (slug: string | undefined): boolean =>
  slug !== undefined && createdHere.has(slug);

export const clearCreatedHere = (slug: string | undefined): void => {
  if (slug !== undefined) {
    createdHere.delete(slug);
  }
};
