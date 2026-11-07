import { ToolCallBlockedError } from '@work/application/errors/tool-call-blocked.error';
import { ToolCallFailedError } from '@work/application/errors/tool-call-failed.error';
import type { ToolCallFailureDto } from '@work/application/ports/integration-tool-calls.port';

export const ToolCallFailures = {
  errorOf(failure: ToolCallFailureDto): Error {
    return failure.blocked
      ? new ToolCallBlockedError(failure.reason)
      : new ToolCallFailedError(failure.reason);
  },
};
