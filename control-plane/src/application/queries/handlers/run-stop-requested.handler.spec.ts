import { RunStopRequestedHandler } from '@application/queries/handlers/run-stop-requested.handler';
import { RunStopRequestedQuery } from '@application/queries/run-stop-requested.query';
import { Run } from '@domain/aggregates/run.aggregate';
import type { RunRepository } from '@domain/repositories/run.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'do the thing',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  continuity: { key: 'task_1-station_1', keep: true },
});

const claimedRun = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec,
  }).claim(RunnerId.of('runner_1'), NOW);

const asking = (run: Run | null) =>
  new RunStopRequestedHandler({
    findById: vi.fn(async () => run),
  } as unknown as RunRepository);

describe('RunStopRequestedHandler', () => {
  it('says no when nobody has asked the run to stop', async () => {
    const answer = await asking(claimedRun()).execute(
      new RunStopRequestedQuery('run_1'),
    );

    expect(answer).toBe(false);
  });

  it('says yes once a person has asked', async () => {
    const answer = await asking(claimedRun().requestStop(NOW)).execute(
      new RunStopRequestedQuery('run_1'),
    );

    expect(answer).toBe(true);
  });

  it('says no for a run it can no longer find', async () => {
    const answer = await asking(null).execute(
      new RunStopRequestedQuery('gone'),
    );

    expect(answer).toBe(false);
  });
});
