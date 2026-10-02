import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';
import {
  RunSpecContract,
  type RunSpecShape,
} from '@work/application/contracts/run-spec.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { NamedMemory } from '@work/application/ports/memories-briefed-before.port';
import type { BriefedPlace } from '@work/application/ports/team-memories.port';
import { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import { candidateOf } from '@work/application/services/replay-candidates.fake-spec';
import { StationCatalog } from '@work/application/services/station-catalog.service';
import type { StationSkills } from '@work/application/services/station-skills.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { Sha256ContentDigest } from '@work/infrastructure/hashing/sha256-content-digest';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const BUILD = StationId.of('station_build');
const ORIGINAL = RunId.of('run_1');
const ARCHIVE = WorkspaceArchiveId.of('archive_1');
const API = 'a'.repeat(40);

const DEV = Harness.of({
  id: HarnessId.of('dev'),
  name: HarnessName.of('Dev'),
});

const harnesses: HarnessCatalog = {
  all: () => [DEV],
  named: (id: HarnessId) => (id.equals(DEV.id) ? DEV : null),
};

const commandFor: HarnessLaunchPort['commandFor'] = (id, chosen) =>
  id.equals(DEV.id)
    ? HarnessCommand.of({
        executable: 'dev-agent',
        args: ['--acp'],
        env: chosen.model ? { DEV_MODEL: chosen.model.value } : {},
      })
    : null;

const launch: HarnessLaunchPort = {
  skillsFor: () => ({ directory: '.claude/skills', readByHarness: true }),
  skillHomes: () => ['.claude/skills'],
  settingFiles: () => ['claude/settings.json'],
  commandFor,
  preparedFor: (id, chosen) => {
    const command = commandFor(id, chosen);

    return command
      ? {
          command,
          setup: chosen.profile
            ? {
                files: [
                  {
                    path: 'dev/servers.json',
                    text: chosen.profile.mcpServers
                      .map((each) => each.name)
                      .join(','),
                  },
                ],
                mcpServers: chosen.profile.mcpServers.map((server) => ({
                  name: server.name,
                  command: server.command,
                  args: [...server.args],
                  env: Object.entries(server.env).map(([name, value]) => ({
                    name,
                    value,
                  })),
                })),
                asks: ['execute'],
              }
            : null,
        }
      : null;
  },
  catalogue: () => [],
};

const LINEAR: HarnessProfileShape = {
  key: 'linear',
  rules: [],
  mcpServers: [
    {
      name: 'linear',
      command: 'npx',
      args: ['-y', 'linear-mcp'],
      env: { LINEAR_API_KEY: 'secret.LINEAR_API_KEY' },
    },
  ],
  native: {},
};

const SCREENSHOT = Attachment.of({
  id: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47',
  name: 'queue-stuck.png',
  contentType: 'image/png',
  size: 2_048,
});

const station = (
  id: StationId,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: StationColor.plain(),
    ...extra,
  });

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  repositories: [
    WorkedRepository.of(Repository.of('acme/api'), {
      setup: RepositorySetup.of('npm ci'),
    }),
  ],
  stations: [
    station(StationId.of('station_backlog'), 'backlog', 0, { kind: 'backlog' }),
    station(BUILD, 'build', 1, {
      harness: HarnessId.of('dev'),
      diffs: true,
      check: StationCheck.of('npm test'),
      profile: ProfileKey.of('linear'),
      tools: [Tool.of('linear.comment'), Tool.of('catalog.web-search@1.1.0')],
    }),
    station(StationId.of('station_completed'), 'completed', 2, {
      kind: 'completed',
    }),
  ],
});

const BRIEFED = BriefedTask.of({
  stationId: BUILD,
  title: 'Drain the queue',
  description: 'It stalls on restart.',
  reviewing: null,
  attachments: [SCREENSHOT],
  notes: [],
  openRemarks: [],
  decisions: [
    {
      kind: 'assumption',
      title: 'Restarts are rare',
      why: 'The queue drains between deploys.',
      paths: ['src/queue.ts'],
      disputes: [],
    },
  ],
});

const original = (startedFrom: StartingPoint | null = null) =>
  Run.rehydrate({
    id: ORIGINAL,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.of(1),
    subject: RunSubject.task(TaskId.of('task_1'), BUILD, TaskRevision.of(1)),
    spec: RunSpec.of({
      checkouts: [
        {
          remote: 'spotlight:repository',
          path: 'api',
          branch: 'spotlight/task_1',
        },
      ],
      command: { executable: 'dev-agent', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task-task_1' },
      startingPoint: true,
    }),
    state: 'completed',
    claimedBy: null,
    leaseExpiresAt: null,
    outcome: null,
    attempt: 1,
    reservation: null,
    provisioning: Provisioning.none(),
    briefedWith: BriefedMemories.of({
      briefed: [{ id: 'memory_1', handle: 'M-1' }],
      cut: [{ id: 'memory_2', handle: 'M-2' }],
    }),
    startedFrom,
  });

const STARTED = StartingPoint.of({
  archive: ARCHIVE,
  checkouts: [StartedCheckout.of({ path: 'api', commit: API })],
  attempt: 1,
  at: NOW,
});

const SIZE = ArchiveSize.of(1_024);
const DIGEST = ArchiveDigest.of('a'.repeat(64));

const sealed = (workspace = 'ws_1') =>
  WorkspaceArchive.granted({
    id: ARCHIVE,
    workspaceId: WorkspaceId.of(workspace),
    continuity: ContinuityKey.forTask('task_1'),
    holder: { kind: 'task', taskId: TaskId.of('task_1') },
    run: ORIGINAL,
    size: SIZE,
    digest: DIGEST,
    at: NOW,
  }).sealed({ size: SIZE, digest: DIGEST }, NOW);

let gone: string[] = [];
let taskGone = false;
let held: Run | null = null;
let kept: WorkspaceArchive | null = null;
let queued: Run[] = [];
let askedAgain: { place: BriefedPlace; briefed: readonly NamedMemory[] }[] = [];

const dispatching = () =>
  new DispatchReplay(
    {
      findById: async (id: RunId) =>
        id.equals(ORIGINAL)
          ? held
          : (queued.find((each) => each.id.equals(id)) ?? null),
      add: async (run: Run) => {
        queued.push(run);
      },
    } as unknown as RunRepository,
    { find: async () => kept } as unknown as WorkspaceArchiveRepository,
    {
      find: async () => (taskGone ? null : {}),
    } as unknown as TaskRepository,
    { of: async () => BRIEFED },
    { generate: () => 'run_2' },
    harnesses,
    launch,
    {
      for: (taskId, runId) => `trace:${taskId.value}:${runId.value}`,
      forChat: (chatId, runId) => `trace:${chatId.value}:${runId.value}`,
    },
    { named: () => null },
    { readyAt: async () => [] } as unknown as StationSkills,
    new StationCatalog({
      givenTo: async () => ({
        tools: [],
        skills: [],
        refused: [
          {
            id: 'catalog.web-search@1.1.0',
            reason: 'not-entitled',
            because: 'The plan does not include it.',
          },
        ],
      }),
      call: async () => ({ kind: 'answered', output: null }),
    }),
    { named: async (_team, key) => (key === 'linear' ? LINEAR : null) },
    {
      again: async (place, chosen) => {
        askedAgain.push({ place, briefed: chosen.briefed });
        return {
          briefed: [
            {
              id: 'memory_1',
              handle: 'M-1',
              kind: 'convention',
              body: 'Queues drain oldest first.',
            },
          ],
          cut: [...chosen.cut],
          folder: null,
        };
      },
    },
    {
      received: async (
        _workspace: WorkspaceId,
        ids: readonly AttachmentId[],
      ) => {
        if (ids.some((each) => gone.includes(each.value))) {
          throw new InvalidAttachmentError('was never uploaded');
        }
        return [];
      },
    } as unknown as AttachmentStorePort,
    new Sha256ContentDigest(),
  );

const written = (run?: Run): RunSpecShape => {
  if (!run) {
    throw new Error('nothing was queued');
  }
  return RunSpecContract.toWire(run.spec);
};

const refusalOf = async (asked: Promise<unknown>) =>
  asked.then(
    () => {
      throw new Error('the replay was queued');
    },
    (error: unknown) => {
      if (error instanceof UnreplayableRunError) {
        return error.refusal;
      }
      throw error;
    },
  );

describe('DispatchReplay', () => {
  beforeEach(() => {
    held = original(STARTED);
    kept = sealed();
    queued = [];
    askedAgain = [];
    gone = [];
    taskGone = false;
  });

  it('queues a replay of the run under the candidate, starting where the run started', async () => {
    const candidate = candidateOf(LINE, BUILD, {
      model: HarnessModel.of('dev-large'),
    });

    const id = await dispatching().enqueue({ original: ORIGINAL, candidate });
    const run = queued[0] as Run;
    const spec = written(run);

    expect(id.value).toBe('run_2');
    expect(run.id.equals(id)).toBe(true);
    expect(run.replayOf?.equals(ORIGINAL)).toBe(true);
    expect(run.taskId).toBeNull();
    expect(run.stationId?.equals(BUILD)).toBe(true);
    expect(run.priority.value).toBe(-1);
    expect(spec.replay).toEqual({
      archive: 'archive_1',
      checkouts: [{ path: 'api', commit: API, repository: 'acme/api' }],
      movesOnAfter: [],
    });
    expect(spec.checkouts).toEqual([
      {
        remote: 'spotlight:repository',
        path: 'api',
        ref: API,
        setup: 'npm ci',
      },
    ]);
    expect(spec.continuity).toEqual({ key: 'replay-run_2' });
    expect(spec.command.env).toMatchObject({ DEV_MODEL: 'dev-large' });
    expect(spec.diffs).toBe(true);
    expect(spec.check).toBe('npm test');
    expect(spec.attachments).toEqual([
      { id: SCREENSHOT.id.value, path: expect.any(String) },
    ]);
    expect(spec.briefing).toContain('## Drain the queue');
    expect(spec.briefing).toContain('Restarts are rare');
    expect(run.hasEnded).toBe(false);
  });

  it('refuses no replay for a catalog tool its plan withholds, as a replay is given no tools', async () => {
    await dispatching().enqueue({ original: ORIGINAL, candidate: LINE });

    expect(queued[0]?.hasEnded).toBe(false);
  });

  it('gives the replay no tools, MCP servers or secrets, and never asks it where it started', async () => {
    await dispatching().enqueue({ original: ORIGINAL, candidate: LINE });

    const spec = written(queued[0]);

    expect(spec.manifest).toBeUndefined();
    expect(spec.catalog).toBeUndefined();
    expect(spec.wears).toBeUndefined();
    expect(spec.startingPoint).toBeUndefined();
    expect(spec.harnessSetup).toEqual({
      files: [{ path: 'dev/servers.json', text: '' }],
      mcpServers: [],
      asks: ['execute'],
    });
  });

  it('records the candidate’s config, so a replay can be told from its original', async () => {
    await dispatching().enqueue({ original: ORIGINAL, candidate: LINE });
    await dispatching().enqueue({
      original: ORIGINAL,
      candidate: candidateOf(LINE, BUILD, {
        model: HarnessModel.of('dev-large'),
      }),
    });

    const [same, changed] = queued.map((each) => each.configuredAs);

    expect(same?.parts.model).toBeNull();
    expect(changed?.parts.model).toBe('dev-large');
    expect(same?.fingerprint).not.toBe(changed?.fingerprint);
  });

  it('briefs the memories the original was briefed with, never searching afresh', async () => {
    await dispatching().enqueue({ original: ORIGINAL, candidate: LINE });

    expect(askedAgain).toEqual([
      {
        place: {
          teamId: TeamId.of('team_1'),
          lineId: 'line_1',
          stationId: 'station_build',
          repositories: [Repository.of('acme/api')],
        },
        briefed: [{ id: 'memory_1', handle: 'M-1' }],
      },
    ]);
    expect(written(queued[0]).briefing).toContain('Queues drain oldest first.');
    expect(queued[0]?.briefedWith.value).toEqual({
      briefed: [{ id: 'memory_1', handle: 'M-1' }],
      cut: [{ id: 'memory_2', handle: 'M-2' }],
    });
  });

  it('refuses a run there is no record of', async () => {
    held = null;

    expect(
      await refusalOf(
        dispatching().enqueue({ original: ORIGINAL, candidate: LINE }),
      ),
    ).toBe('unknown-run');
  });

  it('refuses a run that never said where it started', async () => {
    held = original(null);

    expect(
      await refusalOf(
        dispatching().enqueue({ original: ORIGINAL, candidate: LINE }),
      ),
    ).toBe('no-starting-point');
    expect(queued).toEqual([]);
  });

  it('refuses a run whose archive is no longer kept, naming it', async () => {
    for (const gone of [null, sealed('ws_2')]) {
      kept = gone;

      await expect(
        dispatching().enqueue({ original: ORIGINAL, candidate: LINE }),
      ).rejects.toThrow(/archive_1/);
    }
    expect(queued).toEqual([]);
  });

  it('refuses a run whose briefed files are no longer kept', async () => {
    gone = [SCREENSHOT.id.value];

    expect(
      await refusalOf(
        dispatching().enqueue({ original: ORIGINAL, candidate: LINE }),
      ),
    ).toBe('attachments-gone');
    expect(queued).toEqual([]);
  });

  it('refuses a candidate no runner can start', async () => {
    expect(
      await refusalOf(
        dispatching().enqueue({
          original: ORIGINAL,
          candidate: candidateOf(LINE, BUILD, {
            harness: HarnessId.of('missing'),
          }),
        }),
      ),
    ).toBe('cannot-start');
  });

  it('refuses a run whose task was deleted', async () => {
    taskGone = true;

    expect(
      await refusalOf(
        dispatching().enqueue({ original: ORIGINAL, candidate: LINE }),
      ),
    ).toBe('task-gone');
    expect(queued).toEqual([]);
  });

  it('queues a replay under the id it is asked for once, however often it is asked', async () => {
    const id = RunId.of('run_9');

    expect(
      (await dispatching().enqueue({ original: ORIGINAL, candidate: LINE, id }))
        .value,
    ).toBe('run_9');
    held = null;
    expect(
      (await dispatching().enqueue({ original: ORIGINAL, candidate: LINE, id }))
        .value,
    ).toBe('run_9');
    expect(queued.map((each) => each.id.value)).toEqual(['run_9']);
  });

  it('refuses to take a run queued under the id as its replay when it replays another run', async () => {
    const id = RunId.of('run_9');
    await dispatching().enqueue({ original: ORIGINAL, candidate: LINE, id });

    await expect(
      dispatching().alreadyQueued(id, RunId.of('run_elsewhere')),
    ).rejects.toThrow(InconsistentStateError);
    expect(await dispatching().alreadyQueued(id, ORIGINAL)).toBe(true);
  });
});
