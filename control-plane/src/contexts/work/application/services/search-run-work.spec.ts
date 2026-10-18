import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SearchRunWork } from '@work/application/services/search-run-work';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { NotAllowedInSearchError } from '@work/domain/exceptions/not-allowed-in-search.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const search = () =>
  Run.enqueue({
    id: RunId.of('run_9'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    subject: RunSubject.search(
      SearchId.of('search_1'),
      SearchIteration.of(1),
      StationId.of('station_build'),
      TeamId.of('team_1'),
    ),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Find a better Build station.',
      handover: { options: [], noteLimit: 0 },
      resume: { key: 'search-run_9' },
      search: {},
    }),
  }).claim(RUNNER, NOW);

const working = () => {
  const saved: Run[] = [];
  const searched = search();
  let current: Run = searched.renewLease(RUNNER, NOW);
  const work = new SearchRunWork(searched, {
    findById: async () => current,
    save: async (run: Run) => {
      if (run.version !== current.version) {
        throw new Error('saved a run that changed');
      }
      saved.push(run);
      current = run;
    },
  } as unknown as RunRepository);

  return { work, saved };
};

describe('the work of a search', () => {
  it('uses no repository, to fetch or to push', async () => {
    const { work } = working();

    await expect(work.repositoryNamed('api')).rejects.toThrow(
      NotAllowedInSearchError,
    );
  });

  it('reads no attachment', () => {
    expect(working().work.attachment()).toBeNull();
  });

  it('uses no tool', async () => {
    const { work } = working();

    await expect(work.toolContext()).rejects.toThrow(NotAllowedInSearchError);
    expect((await work.clearFor()).kind).toBe('refused');
  });

  it('takes up nothing a person says', async () => {
    await expect(working().work.acknowledgeUpTo()).rejects.toThrow(
      NotAllowedInSearchError,
    );
  });

  it('records a permission it would have asked a person for on the run, and ends its turn there', async () => {
    const { work, saved } = working();

    expect(await work.clearPermission()).toBe('asked');
    expect(saved[0]?.askedAPerson).toBe(true);
  });
});
