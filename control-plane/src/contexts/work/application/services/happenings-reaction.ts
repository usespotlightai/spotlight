import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { HappeningsReaction } from '@work/application/ports/happening-reactions.port';

export const REACTED: HappeningsReaction = { kind: 'reacted' };

const failed = (transient: boolean, reason: string): HappeningsReaction => ({
  kind: 'failed',
  transient,
  reason,
});

export const HELD = failed(
  true,
  'A task this word is for is still deciding what its run handed over. Send it again shortly.',
);

export const failedReactionOf = (error: unknown): HappeningsReaction | null => {
  if (error instanceof UpstreamError) {
    return failed(error.retryable, error.message);
  }

  if (error instanceof DomainError || error instanceof ApplicationError) {
    switch (error.kind) {
      case 'conflict':
        return failed(true, error.message);
      case 'invalid':
      case 'not-allowed':
      case 'not-found':
        return failed(false, error.message);
      case 'internal':
      case 'upstream-error':
        return null;
    }
  }

  return null;
};
