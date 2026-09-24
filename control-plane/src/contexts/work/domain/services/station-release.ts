import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessVersion } from '@shared-kernel/domain/value-objects/harness-version.vo';

export const releaseRefused = (
  harness: HarnessId | null,
  version: HarnessVersion | null,
): string | null =>
  version && !harness
    ? 'pins a release of its harness, so it has to name one'
    : null;
