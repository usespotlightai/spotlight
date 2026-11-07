import { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import { ReplaysRequester } from '@replays/domain/value-objects/replays-requester.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { HarnessCommands } from '@replays/infrastructure/acl/harness-commands';
import { Runs } from '@replays/infrastructure/acl/runs.adapter';
import { WorkTrialRun } from '@replays/infrastructure/acl/work-trial-run';
import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import type { RunsPort as RunQueuePort } from '@runs/application/ports/runs.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_trial');

const runsWith = (enqueued: RunOrderContract[], command = true) =>
  new Runs(
    {
      enqueue: async (order: RunOrderContract) => {
        enqueued.push(order);
        return { outcome: 'enqueued' };
      },
    } as unknown as RunQueuePort,
    {} as RunFactsPort,
    {} as RunLeasesPort,
    {
      problemOf: () => null,
      commandFor: () =>
        command ? { executable: 'claude', args: ['-p'] } : null,
    } as unknown as HarnessCommands,
  );

const TRIAL = new WorkTrialRun(
  {
    runId: RUN.value,
    workspaceId: 'ws_1',
    harness: 'claude-code',
    priority: -1,
    placement: { labelGroups: [], image: null },
    spec: {
      command: { executable: 'claude', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: ['ship'], noteLimit: 0 },
      resume: {},
    },
    restore: { archive: 'archive_1' },
    refusal: null,
    team: 'team_1',
  },
  [{ path: 'api', repository: 'acme/api', commit: 'abc' }],
  null,
  MovesOnWords.of(['Ship', 'done']),
);

describe('Runs (Replays ACL)', () => {
  it('enqueues a trial as an isolated replay run of the trial’s team', async () => {
    const enqueued: RunOrderContract[] = [];

    expect(
      await runsWith(enqueued).enqueueTrial({ run: RUN, trial: TRIAL }),
    ).toEqual({ outcome: 'enqueued' });

    const [order] = enqueued;
    expect(order?.requester).toEqual({
      owner: 'replays',
      kind: 'replay',
      id: RUN.value,
      token: null,
      team: 'team_1',
    });
    expect(order?.policy).toEqual({
      holdsTurn: false,
      gated: false,
      actsBeyondItself: false,
      asks: 'recorded',
      listed: false,
      exclusive: false,
    });
    expect(order?.workingCopy?.key).toBe(`replays/replay-${RUN.value}`);
    expect(order?.extensions.replay).toEqual({
      archive: 'archive_1',
      checkouts: [{ path: 'api', commit: 'abc', repository: 'acme/api' }],
      movesOnAfter: ['ship', 'done'],
    });
    expect(order?.restore).toEqual({ archive: 'archive_1' });
  });

  it('enqueues a search iteration with the station’s placement, or says no runner can start its harness', async () => {
    const enqueued: RunOrderContract[] = [];
    const order = {
      run: RunId.of('run_search'),
      requester: ReplaysRequester.searchIteration(SearchId.of('search_1'), 3),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      agent: { harness: 'claude-code', model: null, effort: null },
      briefing: 'Search.',
      placement: RunnerPlacement.of(['gpu']),
    } as const;

    await runsWith(enqueued).enqueueSearch(order as never);

    expect(enqueued[0]?.requester).toEqual({
      owner: 'replays',
      kind: 'search',
      id: 'search_1',
      token: '3',
      team: 'team_1',
    });
    expect(enqueued[0]?.workingCopy?.key).toBe('replays/search-run_search');
    expect(enqueued[0]?.placement.labelGroups).toEqual([['gpu']]);
    expect(await runsWith([], false).enqueueSearch(order as never)).toEqual({
      outcome: 'harness-unavailable',
    });
  });
});
