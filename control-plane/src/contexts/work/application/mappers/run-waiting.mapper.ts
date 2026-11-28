import type { RunWaitFact } from '@runs/application/ports/run-facts.port';
import type { RunWaitingDto } from '@work/application/dto/run-waiting.dto';

export const RunWaitingMapper = {
  toDto(waiting: RunWaitFact | null): RunWaitingDto | null {
    return (
      waiting && {
        reason: waiting.reason,
        since: waiting.since.toISOString(),
        quiet: waiting.quiet && {
          hosts: waiting.quiet.hosts,
          since: waiting.quiet.since?.toISOString() ?? null,
        },
      }
    );
  },
};
