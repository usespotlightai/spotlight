import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const referenceFor = (
  original: RunId,
  acceptedAfter: boolean,
): RunId | null => (acceptedAfter ? original : null);
