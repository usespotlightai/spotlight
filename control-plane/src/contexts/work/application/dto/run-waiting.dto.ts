import { RUN_WAIT_REASON_FACTS } from '@runs/application/ports/run-facts.port';

export const RUN_WAIT_REASON_NAMES = RUN_WAIT_REASON_FACTS;

// The hosts a queued run waits for while none of them reports in.
interface QuietHostsDto {
  readonly hosts: readonly string[];
  readonly since: string | null;
}

// Why a queued run waits, as Runs last saw it.
export interface RunWaitingDto {
  readonly reason: (typeof RUN_WAIT_REASON_NAMES)[number];
  readonly since: string;
  readonly quiet: QuietHostsDto | null;
}
