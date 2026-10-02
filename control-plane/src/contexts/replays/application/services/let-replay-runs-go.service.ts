import type { WorkPort } from '@replays/application/ports/work.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class LetReplayRunsGo {
  constructor(private readonly work: WorkPort) {}

  async stopped(runs: readonly RunId[]): Promise<void> {
    for (const run of runs) {
      await this.work.forgo(run, false);
    }
  }

  overBudget(runs: readonly RunId[]): Promise<void> {
    return this.work.withdraw(runs);
  }
}
