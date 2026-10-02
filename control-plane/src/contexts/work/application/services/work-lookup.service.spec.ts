import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  JournalStep,
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { WorkLookup } from '@work/application/services/work-lookup.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const WORKSPACE = WorkspaceId.of('ws_1');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const [opening] = BUILT_IN_LINES;

const line = Line.open({
  by: attributedIn(),
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  // biome-ignore lint/style/noNonNullAssertion: Spotlight ships lines
  line: opening!,
  newId: fresh,
});

const task = () =>
  Task.add({
    line,
    // biome-ignore lint/style/noNonNullAssertion: the delivery line has an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-18T12:00:00.000Z'),
    newId: fresh,
  });

const lookingUp = (wearers: readonly Task[]) =>
  new WorkLookup(
    {} as RunRepository,
    {
      holding: async (_at: WorkspaceId, concerns: Concerns) =>
        wearers.find((each) =>
          concerns.marks.some((mark) =>
            each.marks.some((worn) => worn.equals(mark)),
          ),
        ) ?? null,
    } as unknown as TaskRepository,
    { holding: async () => line } as unknown as LineRepository,
    {} as ChatRepository,
    {} as RunJournalReaderPort,
  );

describe('WorkLookup, finding the task a pull request belongs to', () => {
  it('finds the task that opened it before one that reviews it', async () => {
    const reviewing = task().reviews(PULL, { outside: false });
    const opened = task().markedBy(Mark.pullRequest(PULL));

    const found = await lookingUp([reviewing, opened]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(opened.id)).toBe(true);
  });

  it('finds the task reviewing it where no task of Spotlight’s opened it', async () => {
    const reviewing = task().reviews(PULL, { outside: false });

    const found = await lookingUp([reviewing]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(reviewing.id)).toBe(true);
    expect(found?.reviewing).toBe(true);
  });

  it('says whether the pull request a task reviews came from outside the team', async () => {
    const outside = task().reviews(PULL, { outside: true });

    const found = await lookingUp([outside]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.fromOutside).toBe(true);
  });
});

describe('WorkLookup, looking up a run', () => {
  const lookingUpAt = (
    key: string,
    state = 'completed',
    placement = RunnerPlacement.anywhere(),
  ) => {
    const station = line.stations.find((each) => each.key.value === key);

    return new WorkLookup(
      {
        findById: async () => ({
          id: RunId.of('run_1'),
          workspaceId: WORKSPACE,
          taskId: null,
          stationId: station?.id ?? null,
          hasEnded: true,
          hasCompleted: state === 'completed',
          briefedWith: BriefedMemories.none(),
          placement,
          spec: RunSpec.of({
            checkouts: [
              { remote: 'spotlight:repository', path: 'api', setup: 'npm ci' },
            ],
            command: { executable: 'claude', args: [] },
            briefing: 'Retry uploads',
            handover: { options: [], noteLimit: 0 },
            continuity: { key: 'task_1' },
            check: 'npm run verify',
          }),
        }),
      } as unknown as RunRepository,
      {} as TaskRepository,
      { holding: async () => line } as unknown as LineRepository,
      {} as ChatRepository,
      {} as RunJournalReaderPort,
    );
  };

  const runAt = (
    key: string,
    state = 'completed',
    placement = RunnerPlacement.anywhere(),
  ) => lookingUpAt(key, state, placement).run(RunId.of('run_1'));

  const placeAt = (key: string) => lookingUpAt(key).placeOf(RunId.of('run_1'));

  it('hands a check the command its run was dispatched with, not the station’s as it stands now', async () => {
    expect((await runAt('implementation'))?.check).toBe('npm run verify');
    expect((await runAt('gone'))?.check).toBe('npm run verify');
  });

  it('hands a check the setup each checkout carried into its run', async () => {
    expect((await runAt('spec'))?.setups.get('api')).toBe('npm ci');
  });

  it('says the run records its decisions where its station does', async () => {
    expect((await runAt('implementation'))?.decisions).toBe(true);
  });

  it('says it records none where its station does not', async () => {
    expect((await runAt('spec'))?.decisions).toBe(false);
  });

  it('asks a check to run where its station runs', async () => {
    expect((await runAt('implementation'))?.placement.isAnywhere).toBe(true);
  });

  it('asks a check to run where its run was placed once its station is gone', async () => {
    expect(
      (await runAt('gone', 'completed', RunnerPlacement.of(['vpc-internal'])))
        ?.placement.clauses,
    ).toEqual([['vpc-internal']]);
  });

  it('says where the run worked: its team, line and station', async () => {
    const place = await placeAt('implementation');

    expect(place?.teamId.value).toBe('team_1');
    expect(place?.lineId).toBe(line.id.value);
    expect(place?.lineName).toBe(line.name.value);
    expect(place?.stationName).toBe('Implementation');
  });

  it('says a run whose station is gone worked nowhere it can name', async () => {
    expect(await placeAt('gone')).toBeNull();
  });

  it('says the run is remembered from only where its station asks for it', async () => {
    expect((await runAt('implementation'))?.memories).toBe(false);
  });

  it('says whether the run completed, not only whether it ended', async () => {
    expect((await runAt('implementation'))?.completed).toBe(true);
    expect((await runAt('implementation', 'failed'))?.completed).toBe(false);
  });
});

describe('WorkLookup, reading how a run reasoned', () => {
  const step = (change: Partial<JournalStep>): JournalStep => ({
    kind: 'tool',
    text: '',
    status: null,
    tool: null,
    detail: null,
    ms: 0,
    startedAt: new Date('2026-09-21T10:00:00.000Z'),
    locations: [],
    given: null,
    returned: null,
    change: null,
    ...change,
  });

  const edited = (path: string) =>
    step({ change: { path, before: 'a', after: 'b' } });

  const specOf = (folders: readonly string[]) =>
    RunSpec.of({
      checkouts: folders.map((path) => ({
        remote: 'https://spotlight.example/git',
        path,
      })),
      command: { executable: 'claude', args: [] },
      briefing: 'Retry uploads',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task_1' },
    });

  const changesOf = (
    runId: string,
    steps: readonly JournalStep[],
    checkouts: readonly string[],
  ): RunChanges => ({
    runId,
    checkouts,
    paths: steps.flatMap((each) =>
      each.change?.path ? [each.change.path] : [],
    ),
  });

  const reading = (
    steps: readonly JournalStep[],
    earlier: readonly JournalStep[] | null = null,
    earlierFolders: readonly string[] = ['api', 'web'],
  ) =>
    new WorkLookup(
      {
        findById: async (id: RunId) => ({
          id,
          taskId: earlier ? TaskId.of('task_1') : null,
          spec: specOf(['api', 'web']),
        }),
      } as unknown as RunRepository,
      {} as TaskRepository,
      {} as LineRepository,
      {} as ChatRepository,
      {
        ofRun: async () => ({ runId: 'run_1', steps }) as unknown as RunJournal,
        changesOfTask: async () => [
          changesOf('run_0', earlier ?? [], earlierFolders),
          changesOf('run_1', steps, ['api', 'web']),
        ],
      } as unknown as RunJournalReaderPort,
    ).reasoning(RunId.of('run_1'));

  it('offers what the agent said, thought and planned, where it stands in the journal', async () => {
    const reasoned = await reading([
      step({ kind: 'planned', text: '[pending] Retry uploads' }),
      step({ kind: 'tool', text: 'Edit uploads.ts' }),
      step({ kind: 'thought', text: 'A queue needs a worker.' }),
      step({ kind: 'said', text: '  ' }),
      step({ kind: 'said', text: 'Retrying in the request.' }),
    ]);

    expect(reasoned?.steps.map((each) => [each.index, each.kind])).toEqual([
      [0, 'planned'],
      [2, 'thought'],
      [4, 'said'],
    ]);
  });

  it('offers the note the agent handed its work over with', async () => {
    const reasoned = await reading([
      step({ kind: 'tool', text: 'npm test' }),
      step({
        kind: 'tool',
        text: 'spotlight handover --next "code-review" --note "Matches are case-sensitive for now."',
      }),
    ]);

    expect(reasoned?.steps).toEqual([
      {
        index: 1,
        kind: 'handover',
        text: 'spotlight handover --next "code-review" --note "Matches are case-sensitive for now."',
      },
    ]);
  });

  it('names the files earlier runs of the task changed too', async () => {
    const reasoned = await reading(
      [edited('/runs/run_2/api/src/uploads.ts')],
      [edited('/runs/run_1/web/src/Upload.tsx')],
    );

    expect(reasoned?.changed).toEqual([
      'web/src/Upload.tsx',
      'api/src/uploads.ts',
    ]);
  });

  it('places what an earlier run changed by that run’s own checkouts', async () => {
    const reasoned = await reading(
      [edited('/runs/run_1/api/src/uploads.ts')],
      [edited('/runs/run_0/docs/uploads.md')],
      ['docs'],
    );

    expect(reasoned?.changed).toEqual([
      'docs/uploads.md',
      'api/src/uploads.ts',
    ]);
  });

  it('names each file it changed once, from the checkout it lies in', async () => {
    const reasoned = await reading([
      edited('/runs/run_1/api/src/uploads.ts'),
      edited('/runs/run_1/api/src/uploads.ts'),
      edited('/runs/run_1/web/src/Upload.tsx'),
      edited('/tmp/scratch.ts'),
    ]);

    expect(reasoned?.changed).toEqual([
      'api/src/uploads.ts',
      'web/src/Upload.tsx',
    ]);
  });
});

describe('WorkLookup, reading what a run changed', () => {
  const API = Repository.of('acme/api');
  const WEB = Repository.of('acme/web');

  const changing = (paths: readonly string[]) =>
    new WorkLookup(
      {
        findById: async (id: RunId) => ({
          id,
          taskId: null,
          stationId: line.stations[1]?.id,
          spec: RunSpec.of({
            checkouts: ['api', 'web'].map((path) => ({
              remote: 'spotlight:repository',
              path,
            })),
            command: { executable: 'claude', args: [] },
            briefing: 'Retry uploads',
            handover: { options: [], noteLimit: 0 },
            continuity: { key: 'task_1' },
          }),
        }),
      } as unknown as RunRepository,
      {} as TaskRepository,
      {
        holding: async () => ({ repositories: { all: [API, WEB] } }),
      } as unknown as LineRepository,
      {} as ChatRepository,
      {
        ofRun: async () =>
          ({
            runId: 'run_1',
            steps: paths.map((path) => ({
              kind: 'tool',
              text: 'Edit',
              change: { path, before: 'a', after: 'b' },
            })),
          }) as unknown as RunJournal,
      } as unknown as RunJournalReaderPort,
    ).changedBy(RunId.of('run_1'));

  it('names each file the run changed once, in the repository it lies in', async () => {
    const changed = await changing([
      '/runs/run_1/api/src/uploads.ts',
      '/runs/run_1/api/src/uploads.ts',
      '/runs/run_1/web/src/Upload.tsx',
      '/tmp/scratch.ts',
      '/runs/run_1/docs/uploads.md',
    ]);

    expect(changed?.map((each) => [each.repository.value, each.path])).toEqual([
      ['acme/api', 'src/uploads.ts'],
      ['acme/web', 'src/Upload.tsx'],
    ]);
  });
});

describe('WorkLookup, reading what people said on a task', () => {
  const AT = new Date('2026-09-21T10:00:00.000Z');

  const note = (position: number, voice: Voice, body: string) =>
    TaskNote.of({
      position: NotePosition.of(position),
      station: StationName.of('Implementation'),
      body: TaskNoteBody.of(body),
      at: AT,
      voice,
      kind: 'answered',
    });

  it('reads what people and the world said, and nothing the stations did', async () => {
    const spoken = await new WorkLookup(
      {} as RunRepository,
      {
        find: async () => ({
          notes: [
            note(0, Voice.station(RunId.of('run_1')), 'Which bucket?'),
            note(1, Voice.person(UserId.of('user_1')), 'The archive one.'),
            note(2, Voice.world(), 'Never retry on a 403.'),
          ],
        }),
      } as unknown as TaskRepository,
      {} as LineRepository,
      {} as ChatRepository,
      {} as RunJournalReaderPort,
    ).spokenOn(TaskId.of('task_1'));

    expect(spoken).toEqual([
      { position: 1, by: 'person', text: 'The archive one.' },
      { position: 2, by: 'world', text: 'Never retry on a 403.' },
    ]);
  });
});

describe('WorkLookup, reading a team’s lines', () => {
  it('names each line still in use, with the stations that work and its repositories', async () => {
    const retired = { ...line, isRetired: true, id: { value: 'line_old' } };

    const lines = await new WorkLookup(
      {} as RunRepository,
      {} as TaskRepository,
      { ofTeam: async () => [line, retired] } as unknown as LineRepository,
      {} as ChatRepository,
      {} as RunJournalReaderPort,
    ).linesOf(TeamId.of('team_1'));

    expect(lines.map((each) => each.id)).toEqual([line.id.value]);
    expect(lines[0]?.stations.map((each) => each.name)).toEqual(
      line.stations
        .filter((each) => each.isWorked)
        .map((each) => each.name.value),
    );
    expect(lines[0]?.stations.some((each) => each.name === 'Backlog')).toBe(
      false,
    );
  });
});

describe('WorkLookup, finding the run a runner holds', () => {
  const API = Repository.of('acme/api');
  const WEB = Repository.of('acme/web');
  const RUNNER = RunnerId.of('runner_1');
  const TEAM = TeamId.of('team_1');

  const lookingAt = (run: {
    held: boolean;
    chatId?: string | null;
    stationId?: string | null;
    ranFor?: TeamId;
    lineGone?: boolean;
    isSearch?: boolean;
  }) =>
    new WorkLookup(
      {
        findById: async (id: RunId) => ({
          id,
          workspaceId: WORKSPACE,
          taskId: run.chatId ? null : TaskId.of('task_1'),
          chatId: run.chatId ? { value: run.chatId } : null,
          stationId: run.stationId ? { value: run.stationId } : null,
          ranFor: run.ranFor ?? null,
          isSearch: run.isSearch ?? false,
          isReplay: !run.isSearch,
          ...(run.isSearch ? {} : { replayedRepositories: [WEB] }),
          isHeldBy: (by: RunnerId) => run.held && by.equals(RUNNER),
        }),
      } as unknown as RunRepository,
      { find: async () => null } as unknown as TaskRepository,
      {
        holding: async () =>
          run.lineGone
            ? null
            : {
                teamId: TEAM,
                id: { value: 'line_1' },
                repositories: { all: [API] },
              },
      } as unknown as LineRepository,
      {
        find: async () => ({
          teamId: TeamId.of('team_chat'),
          repositories: [WEB],
        }),
      } as unknown as ChatRepository,
      {} as RunJournalReaderPort,
    );

  const holding = (run: Parameters<typeof lookingAt>[0]) =>
    lookingAt(run).heldBy(RunId.of('run_1'), RUNNER);

  it('names the team, task and workspace of a task’s run the runner holds', async () => {
    const held = await holding({ held: true, stationId: 'station_1' });

    expect(held?.teamId.equals(TEAM)).toBe(true);
    expect(held?.lineId).toBe('line_1');
    expect(held?.stationId).toBe('station_1');
    expect(held?.repositories).toEqual([API]);
    expect(held?.taskId?.value).toBe('task_1');
    expect(held?.workspaceId.equals(WORKSPACE)).toBe(true);
  });

  it('names the team a replay runs for, and the repositories it replays, even once its station is gone', async () => {
    const held = await holding({
      held: true,
      ranFor: TEAM,
      lineGone: true,
    });

    expect(held?.teamId.equals(TEAM)).toBe(true);
    expect(held?.lineId).toBeNull();
    expect(held?.stationId).toBeNull();
    expect(held?.repositories).toEqual([WEB]);

    const atItsStation = await holding({
      held: true,
      ranFor: TEAM,
      stationId: 'station_1',
    });

    expect(atItsStation?.lineId).toBe('line_1');
    expect(atItsStation?.stationId).toBe('station_1');
  });

  it('says a search searches, for its team at its station, with no repositories', async () => {
    const held = await holding({
      held: true,
      ranFor: TEAM,
      stationId: 'station_1',
      isSearch: true,
    });

    expect(held?.isSearch).toBe(true);
    expect(held?.teamId.equals(TEAM)).toBe(true);
    expect(held?.stationId).toBe('station_1');
    expect(held?.repositories).toEqual([]);
    expect(
      (await holding({ held: true, stationId: 'station_1' }))?.isSearch,
    ).toBe(false);
  });

  it('names a chat’s own team for a chat’s run', async () => {
    const held = await holding({ held: true, chatId: 'chat_1' });

    expect(held?.teamId.value).toBe('team_chat');
    expect(held?.taskId).toBeNull();
  });

  it('knows no run the runner does not hold, or one belonging to no team', async () => {
    expect(await holding({ held: false, stationId: 'station_1' })).toBeNull();
    expect(await holding({ held: true })).toBeNull();
  });

  it('names the team of any run, held or not, by its chat or its line', async () => {
    const teamOf = (run: Parameters<typeof lookingAt>[0]) =>
      lookingAt(run).siteOfRun(RunId.of('run_1'));

    expect(await teamOf({ held: false, stationId: 'station_1' })).toEqual({
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
      repositories: [API],
    });
    expect(await teamOf({ held: false, chatId: 'chat_1' })).toEqual({
      teamId: TeamId.of('team_chat'),
      lineId: null,
      stationId: null,
      repositories: [WEB],
    });
    expect(await teamOf({ held: false })).toBeNull();
  });
});
