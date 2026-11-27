import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import { RunStopRequestedHandler } from '@runs/application/queries/handlers/run-stop-requested.handler';
import { RunStopRequestedQuery } from '@runs/application/queries/run-stop-requested.query';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it } from 'vitest';

const requesting = (stopping: Record<string, string>) =>
  new RunStopRequestedHandler(
    partial<RunLeasesPort>({
      leasedBy: async (runId: RunId, runnerId: RunnerId) =>
        runnerId.value === 'runner_1'
          ? partial<LeasedRunFacts>({
              stopRequested: stopping[runId.value] === runnerId.value,
            })
          : null,
    }),
  );

describe('RunStopRequestedHandler', () => {
  it('says no when nobody has requested the run to stop', async () => {
    const answer = await requesting({}).execute(
      new RunStopRequestedQuery('run_1', 'runner_1'),
    );

    expect(answer).toBe(false);
  });

  it('says yes once a person has requested a stop', async () => {
    const answer = await requesting({ run_1: 'runner_1' }).execute(
      new RunStopRequestedQuery('run_1', 'runner_1'),
    );

    expect(answer).toBe(true);
  });

  it('tells another runner nothing about a run it does not lease', async () => {
    const answer = await requesting({ run_1: 'runner_1' }).execute(
      new RunStopRequestedQuery('run_1', 'runner_2'),
    );

    expect(answer).toBe(false);
  });
});
