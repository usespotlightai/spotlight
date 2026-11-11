import { OutboundLimitReachedError } from '@integrations/application/errors/outbound-limit-reached.error';
import type {
  CallAttempt,
  ToolOutput,
} from '@integrations/application/ports/integration-runtime.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failedWith = (error: unknown): CallAttempt => {
  if (
    (error instanceof ApplicationError || error instanceof DomainError) &&
    error.kind === 'not-allowed'
  ) {
    return { kind: 'failed', fact: { kind: 'blocked', reason: error.message } };
  }

  if (error instanceof OutboundLimitReachedError) {
    return {
      kind: 'failed',
      fact: { kind: 'over-outbound-limit', perSecond: error.perSecond },
    };
  }

  if (error instanceof UpstreamError) {
    return {
      kind: 'failed',
      fact: {
        kind: 'upstream',
        status: error.status,
        transient: error.retryable,
        reason: error.message,
      },
    };
  }

  return { kind: 'failed', fact: { kind: 'unknown', reason: reasonOf(error) } };
};

const TIMED_OUT = Symbol('timed out');

export const attempted = async (
  calling: () => Promise<ToolOutput>,
  withinMs: number | null,
): Promise<CallAttempt> => {
  if (withinMs === null) {
    try {
      return { kind: 'answered', output: await calling() };
    } catch (error) {
      return failedWith(error);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), Math.max(withinMs, 0));
  });

  try {
    const answer = await Promise.race([calling(), late]);

    return answer === TIMED_OUT
      ? { kind: 'timed-out' }
      : { kind: 'answered', output: answer };
  } catch (error) {
    return failedWith(error);
  } finally {
    clearTimeout(timer);
  }
};
