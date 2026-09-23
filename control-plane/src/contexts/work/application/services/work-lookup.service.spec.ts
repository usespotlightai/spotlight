import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  JournalStep,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { WorkLookup } from '@work/application/services/work-lookup.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
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
    {} as RunJournalReaderPort,
  );

describe('WorkLookup, finding the task a pull request belongs to', () => {
  it('finds the task that opened it before one that reviews it', async () => {
    const reviewing = task().reviews(PULL);
    const opened = task().markedBy(Mark.pullRequest(PULL));

    const found = await lookingUp([reviewing, opened]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(opened.id)).toBe(true);
  });

  it('finds the task reviewing it where no task of Spotlight’s opened it', async () => {
    const reviewing = task().reviews(PULL);

    const found = await lookingUp([reviewing]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(reviewing.id)).toBe(true);
    expect(found?.reviewing).toBe(true);
  });
});

describe('WorkLookup, looking up a run', () => {
  const runAt = (key: string, state = 'completed') => {
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
        }),
      } as unknown as RunRepository,
      {} as TaskRepository,
      { holding: async () => line } as unknown as LineRepository,
      {} as RunJournalReaderPort,
    ).run(RunId.of('run_1'));
  };

  it('says the run records its decisions where its station does', async () => {
    expect((await runAt('implementation'))?.decisions).toBe(true);
  });

  it('says it records none where its station does not', async () => {
    expect((await runAt('spec'))?.decisions).toBe(false);
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
      continuity: { key: 'task_1', keep: false },
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
          spec:
            id.value === 'run_1'
              ? specOf(['api', 'web'])
              : specOf(earlierFolders),
        }),
      } as unknown as RunRepository,
      {} as TaskRepository,
      {} as LineRepository,
      {
        ofRun: async () => ({ runId: 'run_1', steps }) as unknown as RunJournal,
        ofTask: async () =>
          [
            { runId: 'run_0', steps: earlier ?? [] },
            { runId: 'run_1', steps },
          ] as unknown as RunJournal[],
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
