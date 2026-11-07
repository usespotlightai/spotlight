import { Sha256ContentHash } from '@platform/hashing/sha256-content-hash';
import type { HarnessProfileShape } from '@runs/application/contracts/harness-profile.contract';
import { readyProfiles } from '@runs/application/ports/harness-launch.fake-spec';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import { HarnessCommand } from '@runs/application/ports/run-fixtures.fake-spec';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { HarnessCataloguePort } from '@work/application/ports/harness-catalogue.port';
import type { NamedMemory } from '@work/application/ports/memories-briefed-before.port';
import type { RunEvidencePort } from '@work/application/ports/run-evidence.port';
import type { TrialOrdering } from '@work/application/ports/station-trials.port';
import type { BriefedContext } from '@work/application/ports/team-memories.port';
import { candidateOf } from '@work/application/services/candidate-lines.fake-spec';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import { RunCatalog } from '@work/application/services/run-catalog.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import type { StationSkills } from '@work/application/services/station-skills.service';
import { StationTrials } from '@work/application/services/station-trials.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const BUILD = StationId.of('station_build');
const ORIGINAL = RunId.of('run_1');
const API = 'a'.repeat(40);

const DEV = { id: HarnessId.of('dev') };

const harnesses: HarnessCataloguePort = {
  current: () => HarnessCatalogue.of([DEV.id]),
};

const commandFor: HarnessLaunchPort['commandFor'] = (id, chosen) =>
  id.equals(DEV.id)
    ? HarnessCommand.of({
        executable: 'dev-agent',
        args: ['--acp'],
        env: chosen.model ? { DEV_MODEL: chosen.model.value } : {},
      }).started()
    : null;

const launch: HarnessLaunchPort = {
  skillsFor: () => ({ directory: '.claude/skills', readByHarness: true }),
  skillHomes: () => ['.claude/skills'],
  settingFiles: () => ['claude/settings.json'],
  defaultHarness: () => DEV.id,
  commandFor,
  ...readyProfiles,
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
                askKinds: ['execute'],
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
  extra: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    ...extra,
  });

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  repositories: [repositoryOf(Repository.of('acme/api'), { setup: 'npm ci' })],
  stations: [
    station(StationId.of('station_backlog'), 'backlog', 0, { kind: 'backlog' }),
    station(BUILD, 'build', 1, {
      harness: HarnessId.of('dev'),
      diffs: true,
      check: 'npm test',
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
  openReviewComments: [],
});

const ORIGINAL_MEMORIES = BriefedMemories.of({
  briefed: [{ id: 'memory_1', handle: 'M-1' }],
  omitted: [{ id: 'memory_2', handle: 'M-2' }],
});

const ORIGINAL_DISPATCH = Dispatch.ordered({
  id: ORIGINAL,
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  subject: {
    kind: 'task',
    taskId: TaskId.of('task_1'),
    revision: TaskRevision.of(1),
    stationId: BUILD,
  },
  configuredAs: null,
  briefedTask: BRIEFED,
  briefedMemories: ORIGINAL_MEMORIES,
  order: runOrderOf(ORIGINAL),
  now: NOW,
}).enqueuedAsRun();

const factsOf = (over: Partial<RunFacts> = {}): RunFacts =>
  ({
    runId: ORIGINAL,
    workspaceId: WorkspaceId.of('ws_1'),
    ended: true,
    startedFrom: {
      archiveId: 'archive_1',
      archiveStored: true,
      at: NOW,
      checkouts: [{ path: 'api', repository: 'acme/api', commit: API }],
    },
    ...over,
  }) as RunFacts;

let facts: RunFacts | null = null;
let candidate: LineMap = LINE;
let gone: string[] = [];
let taskGone = false;
let taskNotes: TaskNote[] = [];
let trials: Dispatch[] = [];
let requestedAgain: {
  place: BriefedContext;
  briefed: readonly NamedMemory[];
}[] = [];

const trialsOf = () =>
  new StationTrials(
    { of: async () => (facts ? [facts] : []) } as unknown as RunFactsPort,
    {
      find: async (id: RunId) =>
        id.equals(ORIGINAL)
          ? ORIGINAL_DISPATCH
          : (trials.find((each) => each.id.equals(id)) ?? null),
      add: async (trial: Dispatch) => {
        trials.push(trial);
      },
      save: async (trial: Dispatch) => {
        trials = trials.map((each) =>
          each.id.equals(trial.id) ? trial : each,
        );
      },
    } as unknown as DispatchRepository,
    {
      find: async () => (taskGone ? null : { notes: taskNotes }),
    } as unknown as TaskRepository,
    {
      live: async () => ({ line: LINE, station: LINE.stationAt(BUILD) }),
      withStation: async () => ({
        ok: true,
        line: candidate,
        station: candidate.stationAt(BUILD),
        definition: {},
      }),
    } as unknown as CandidateLines,
    new StationOrdering(
      harnesses,
      launch,
      { named: () => null },
      { readyAt: async () => [] } as unknown as StationSkills,
      new RunCatalog({
        entitledTo: async () => ({
          tools: [],
          skills: [],
          denied: [
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
      new Sha256ContentHash(),
    ),
    {
      again: async (place, chosen) => {
        requestedAgain.push({ place, briefed: chosen.briefed });
        return {
          briefed: [
            {
              id: 'memory_1',
              handle: 'M-1',
              kind: 'convention',
              body: 'Queues drain oldest first.',
            },
          ],
          omitted: [...chosen.omitted],
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
    {
      for: (taskId, runId) => `trace:${taskId.value}:${runId.value}`,
      forChat: (chatId, runId) => `trace:${chatId.value}:${runId.value}`,
      of: (requester, runId) => `trace:${requester.id}:${runId.value}`,
    },
    {
      of: async () => ({
        runId: ORIGINAL.value,
        taskId: 'task_1',
        title: 'Drain the queue',
        description: null,
        steps: [],
        hunks: [
          {
            id: 'h1',
            path: 'api/queue.ts',
            index: 0,
            header: '@@ -1 +1 @@',
            lines: ['-drain()', '+drain(oldestFirst)'],
          },
        ],
      }),
    } as unknown as RunEvidencePort,
    { now: () => NOW, sleep: async () => {} },
  );

const request = (
  over: { runId?: string; followUp?: 'accepted' | 'sent-back' | null } = {},
) => ({
  runId: over.runId ?? 'run_2',
  basedOn: ORIGINAL.value,
  workspaceId: 'ws_1',
  lineId: 'line_1',
  stationId: BUILD.value,
  config: {},
  followUp: over.followUp ?? null,
});

const ordered = (
  ordering: TrialOrdering,
): Extract<TrialOrdering, { outcome: 'ordered' }> => {
  if (ordering.outcome !== 'ordered') {
    throw new Error(`the trial was not ordered: ${ordering.reason}`);
  }
  return ordering;
};

const reasonOf = (ordering: TrialOrdering) =>
  ordering.outcome === 'untrialable' ? ordering.reason : null;

describe('StationTrials', () => {
  beforeEach(() => {
    facts = factsOf();
    candidate = LINE;
    trials = [];
    requestedAgain = [];
    gone = [];
    taskGone = false;
    taskNotes = [];
  });

  it('orders a trial of the run under the candidate, starting where the run started', async () => {
    candidate = candidateOf(LINE, BUILD, {
      model: HarnessModel.of('dev-large'),
    });

    const trial = ordered(await trialsOf().order(request()));
    const spec = trial.order.spec;

    expect(trial.order).toMatchObject({
      runId: 'run_2',
      workspaceId: 'ws_1',
      team: 'team_1',
      priority: -1,
      restore: { archive: 'archive_1' },
      refusal: null,
    });
    expect(trial.checkouts).toEqual([
      { path: 'api', commit: API, repository: 'acme/api' },
    ]);
    expect(trial.movesOnAfter).toEqual([]);
    expect(trial.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(spec.checkouts).toEqual([
      {
        remote: 'spotlight:repository',
        path: 'api',
        ref: API,
        setup: 'npm ci',
      },
    ]);
    expect(spec.resume).toEqual({});
    expect(spec.command.env).toMatchObject({ DEV_MODEL: 'dev-large' });
    expect(spec.diffs).toBe(true);
    expect(spec.check).toBe('npm test');
    expect(spec.attachments).toEqual([
      { id: SCREENSHOT.id.value, path: expect.any(String) },
    ]);
    expect(spec.briefing).toContain('## Drain the queue');
    expect(trials[0]?.subject).toMatchObject({
      kind: 'trial',
      basedOn: ORIGINAL,
      asOf: NOW,
      repositories: [{ path: 'api', repository: Repository.of('acme/api') }],
    });
    expect(trials[0]?.configuredAs?.fingerprint).toBe(trial.fingerprint);
  });

  it('briefs a trial of the follow-up with the change people accepted, or with what they said when they sent the run back', async () => {
    taskNotes = [
      TaskNote.of({
        position: NotePosition.of(0),
        station: StationName.of('Build'),
        stationId: BUILD,
        body: TaskNoteBody.of('Done.'),
        at: NOW,
        voice: Voice.station(ORIGINAL),
        kind: 'passed',
      }),
      TaskNote.of({
        position: NotePosition.of(1),
        station: StationName.of('Build'),
        stationId: BUILD,
        body: TaskNoteBody.of('Drain oldest first.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_maya')),
        kind: 'message',
      }),
    ];

    const accepted = ordered(
      await trialsOf().order(request({ followUp: 'accepted' })),
    );
    const sentBack = ordered(
      await trialsOf().order(
        request({ runId: 'run_3', followUp: 'sent-back' }),
      ),
    );

    expect(accepted.order.spec.briefing).toContain('+drain(oldestFirst)');
    expect(sentBack.order.spec.briefing).toContain('> Drain oldest first.');
    expect(await trialsOf().followUpsOf(ORIGINAL.value)).toEqual({
      accepted: true,
      sentBack: true,
    });
  });

  it('refuses a follow-up whose answer is no longer there, recording nothing', async () => {
    expect(
      reasonOf(await trialsOf().order(request({ followUp: 'sent-back' }))),
    ).toBe('answer-gone');
    expect(trials).toEqual([]);
  });

  it('enables no tools, MCP servers or secrets for the trial, and never requests where it started', async () => {
    const spec = ordered(await trialsOf().order(request())).order.spec;

    expect(spec.manifest).toBeUndefined();
    expect(spec.catalog).toBeUndefined();
    expect(spec.injectedSecrets).toBeUndefined();
    expect(spec.startingPoint).toBeUndefined();
    expect(spec.harnessSetup).toEqual({
      files: [{ path: 'dev/servers.json', text: '' }],
      mcpServers: [],
      askKinds: ['execute'],
    });
  });

  it('briefs the memories the original was briefed with, never searching afresh', async () => {
    const spec = ordered(await trialsOf().order(request())).order.spec;

    expect(requestedAgain).toEqual([
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
    expect(spec.briefing).toContain('Queues drain oldest first.');
    expect(trials[0]?.briefedMemories.value).toEqual(ORIGINAL_MEMORIES.value);
    expect(trials[0]?.pullEvents()).toEqual([]);
  });

  it.each([
    [
      'unknown-run',
      () => {
        facts = null;
      },
    ],
    [
      'no-starting-point',
      () => {
        facts = factsOf({ startedFrom: null });
      },
    ],
    [
      'archive-gone',
      () => {
        facts = factsOf({
          startedFrom: {
            archiveId: 'archive_1',
            archiveStored: false,
            at: NOW,
            checkouts: [],
          },
        });
      },
    ],
    [
      'still-running',
      () => {
        facts = factsOf({ ended: false });
      },
    ],
    [
      'attachments-gone',
      () => {
        gone = [SCREENSHOT.id.value];
      },
    ],
    [
      'task-gone',
      () => {
        taskGone = true;
      },
    ],
    [
      'cannot-start',
      () => {
        candidate = candidateOf(LINE, BUILD, {
          harness: HarnessId.of('missing'),
        });
      },
    ],
  ] as const)('refuses a trial as %s', async (reason, given) => {
    given();

    expect(reasonOf(await trialsOf().order(request()))).toBe(reason);
    expect(trials).toEqual([]);
  });

  it('answers a repeated order with the order it stored, and refuses an id that tries another run', async () => {
    const first = await trialsOf().order(request());

    facts = null;

    expect(await trialsOf().order(request())).toEqual(first);
    await expect(
      trialsOf().order({ ...request(), basedOn: 'run_elsewhere' }),
    ).rejects.toThrow(InconsistentStateError);
    expect(trials).toHaveLength(1);
  });

  it('withdraws a trial that was never queued', async () => {
    await trialsOf().order(request());
    await trialsOf().withdraw('run_2');

    expect(trials[0]?.refusedBecause).toBe('withdrawn');
    expect(reasonOf(await trialsOf().order(request()))).toBe('cannot-start');
  });
});
