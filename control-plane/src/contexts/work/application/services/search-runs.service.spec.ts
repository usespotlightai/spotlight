import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SearchRuns } from '@work/application/services/search-runs.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const queued = (subject: RunSubject, search: boolean) =>
  Run.enqueue({
    id: RunId.of('run_9'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    subject,
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Search.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'search-run_9' },
      ...(search ? { search: {} } : {}),
    }),
  });

const SEARCHING = RunSubject.search(
  SearchId.of('search_1'),
  SearchIteration.of(3),
  StationId.of('station_build'),
  TeamId.of('team_1'),
);

const NO_FACTS = { of: async () => [] };

const leasedSearchRunOf = (run: Run | null) =>
  new SearchRuns(
    {
      findById: async () => run,
    } as unknown as RunRepository,
    NO_FACTS,
  ).leasedSearchRun('run_9', RUNNER.value);

describe('SearchRuns', () => {
  it('names the search and iteration of a search run its runner leases', async () => {
    expect(
      await leasedSearchRunOf(queued(SEARCHING, true).claim(RUNNER, NOW)),
    ).toEqual({
      searchId: 'search_1',
      iteration: 3,
    });
  });

  it('names nothing for a search run nobody leases, one another runner leases, or a run that is no search', async () => {
    expect(await leasedSearchRunOf(null)).toBeNull();
    expect(await leasedSearchRunOf(queued(SEARCHING, true))).toBeNull();
    expect(
      await leasedSearchRunOf(
        queued(SEARCHING, true).claim(RunnerId.of('runner_2'), NOW),
      ),
    ).toBeNull();
    expect(
      await leasedSearchRunOf(
        queued(
          RunSubject.task(
            TaskId.of('task_1'),
            StationId.of('station_build'),
            TaskRevision.of(0),
          ),
          false,
        ).claim(RUNNER, NOW),
      ),
    ).toBeNull();
  });

  it('says whether each search run waits, runs or ended, whether it failed, and whether it ever started', async () => {
    const at = (minute: number) => new Date(NOW.getTime() + minute * 60_000);
    const fact = (
      runId: string,
      state: RunState,
      started: Date | null,
      asked = false,
    ) => ({
      runId,
      state,
      askedAPerson: asked,
      attempt: runId === 'lapsed' ? 2 : 1,
      queuedAt: at(0),
      startedAt: started,
      endedAt: state === 'queued' || state === 'claimed' ? null : at(9),
    });
    const facts = [
      fact('waiting', 'queued', null),
      fact('working', 'claimed', at(1)),
      fact('done', 'completed', at(1)),
      fact('asked', 'completed', at(1), true),
      fact('withdrawn', 'superseded', null),
      fact('lapsed', 'queued', null),
    ];

    expect(
      (
        await new SearchRuns({} as RunRepository, {
          of: async () => facts,
        }).statuses(facts.map((each) => each.runId))
      ).map((each) => [each.runId, each.phase, each.failed, each.started]),
    ).toEqual([
      ['waiting', 'queued', true, false],
      ['working', 'running', true, true],
      ['done', 'ended', false, true],
      ['asked', 'ended', true, true],
      ['withdrawn', 'ended', true, false],
      ['lapsed', 'queued', true, true],
    ]);
  });
});
