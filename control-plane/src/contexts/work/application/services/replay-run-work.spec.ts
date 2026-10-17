import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReplayRunWork } from '@work/application/services/replay-run-work';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { KeptFromReplaysError } from '@work/domain/exceptions/kept-from-replays.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const REPLAYED_AS = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

const NOW = new Date('2026-10-01T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');
const BUILD = StationId.of('station_build');
const COMMIT = 'a'.repeat(40);

const SCREENSHOT = Attachment.of({
  id: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47',
  name: 'queue-stuck.png',
  contentType: 'image/png',
  size: 2_048,
});

const briefed = BriefedTask.of({
  stationId: BUILD,
  title: 'Fix the queue',
  description: null,
  reviewing: null,
  attachments: [SCREENSHOT],
  notes: [],
  openRemarks: [],
});

const replay = () =>
  Run.enqueue({
    id: RunId.of('run_2'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    configuredAs: REPLAYED_AS,
    subject: RunSubject.replay(
      RunId.of('run_1'),
      TaskId.of('task_1'),
      BUILD,
      TeamId.of('team_1'),
    ),
    spec: RunSpec.of({
      checkouts: [{ remote: 'spotlight:repository', path: 'api', ref: COMMIT }],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'replay-run_2' },
      replay: {
        archive: null,
        checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
        movesOnAfter: [],
      },
    }),
  }).claim(RUNNER, NOW);

const working = () => {
  const saved: Run[] = [];
  const replayed = replay();
  let current: Run = replayed.renewLease(RUNNER, NOW);
  const work = new ReplayRunWork(replayed, briefed, {
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

describe('the work of a replay', () => {
  it('fetches the repositories it checks out, and no others', async () => {
    const { work } = working();

    expect((await work.repositoryNamed('api', 'git-upload-pack'))?.value).toBe(
      'acme/api',
    );
    expect(await work.repositoryNamed('web', 'git-upload-pack')).toBeNull();
  });

  it('never pushes', async () => {
    const { work } = working();

    await expect(
      work.repositoryNamed('api', 'git-receive-pack'),
    ).rejects.toThrow(KeptFromReplaysError);
  });

  it('reads the files its original was briefed with, and no others', () => {
    const { work } = working();

    expect(work.gave(SCREENSHOT.id.value)?.equals(SCREENSHOT)).toBe(true);
    expect(work.gave('another')).toBeNull();
  });

  it('uses no tool', async () => {
    const { work } = working();

    await expect(work.toolContext()).rejects.toThrow(KeptFromReplaysError);
    expect((await work.clearFor()).kind).toBe('refused');
  });

  it('takes up nothing a person says', async () => {
    const { work } = working();

    await expect(work.deliverUpTo()).rejects.toThrow(KeptFromReplaysError);
  });

  it('records a permission it would have asked a person for on the run as it is now, and ends its turn there', async () => {
    const { work, saved } = working();

    expect(await work.clearPermission()).toBe('asked');
    expect(saved[0]?.askedAPerson).toBe(true);
  });
});
