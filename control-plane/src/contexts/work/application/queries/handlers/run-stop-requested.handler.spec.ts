import { RunStopRequestedHandler } from '@work/application/queries/handlers/run-stop-requested.handler';
import { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';
import { describe, expect, it } from 'vitest';

const asking = (stopping: Record<string, string>) =>
  new RunStopRequestedHandler({
    pendingFor: async () => [],
    stopRequestedFor: async (runId, runnerId) =>
      stopping[runId.value] === runnerId.value,
  });

describe('RunStopRequestedHandler', () => {
  it('says no when nobody has asked the run to stop', async () => {
    const answer = await asking({}).execute(
      new RunStopRequestedQuery('run_1', 'runner_1'),
    );

    expect(answer).toBe(false);
  });

  it('says yes once a person has asked', async () => {
    const answer = await asking({ run_1: 'runner_1' }).execute(
      new RunStopRequestedQuery('run_1', 'runner_1'),
    );

    expect(answer).toBe(true);
  });

  it('tells another runner nothing about a run it does not lease', async () => {
    const answer = await asking({ run_1: 'runner_1' }).execute(
      new RunStopRequestedQuery('run_1', 'runner_2'),
    );

    expect(answer).toBe(false);
  });
});
