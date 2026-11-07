import type { CallAttempt } from '@integrations/application/ports/integration-runtime.port';
import type { RunToolCall } from '@integrations/application/services/resolve-tool-for-run.service';
import type { CallFailureFact } from '@integrations/domain/value-objects/hook-failure.vo';
import type { ToolCallResultDto } from '@work/application/ports/integration-tool-calls.port';

const reasonOf = (fact: CallFailureFact): string =>
  fact.kind === 'over-outbound-limit'
    ? `more than ${fact.perSecond} requests each second`
    : fact.reason;

export const answerOf = async (
  called: Promise<CallAttempt | RunToolCall | ToolCallResultDto>,
): Promise<unknown> => {
  const result = await called;

  if ('outcome' in result) {
    if (result.outcome === 'answered') {
      return result.output;
    }

    throw Object.assign(new Error(result.failure.reason), {
      failure: result.failure,
    });
  }

  if (result.kind === 'answered') {
    return result.output;
  }

  if (result.kind === 'timed-out') {
    throw new Error('timed out');
  }

  throw Object.assign(new Error(reasonOf(result.fact)), { fact: result.fact });
};
