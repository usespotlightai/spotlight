import type {
  StationResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import type { YourMessage } from '@/lib/run';
import { SAM } from '@/mocks/world/people';

type AskedTask = Partial<
  Pick<
    TaskResponseDto,
    'awaitingReview' | 'assignee' | 'hold' | 'finished' | 'stationId'
  >
>;

type Address = {
  readonly toRun: boolean;
  readonly currentRun: boolean;
  readonly atTaskStation: boolean;
};

type StationFacts = {
  readonly harnessed: boolean;
  readonly atCompleted: boolean;
};

export type StationsFacts = (stationId: string | undefined) => StationFacts;

const TO_THE_TASK: Address = {
  toRun: false,
  currentRun: false,
  atTaskStation: true,
};

const ENDED: ReadonlySet<TaskRunResponseDto['state']> = new Set([
  'completed',
  'failed',
  'cancelled',
  'superseded',
]);

export const stationsAmong =
  (...lines: readonly (readonly StationResponseDto[])[]): StationsFacts =>
  (stationId) => {
    const station = lines
      .flat()
      .find((each) => stationId !== undefined && each.id === stationId);

    return {
      harnessed: Boolean(station?.harness),
      atCompleted: station === undefined || station.kind === 'completed',
    };
  };

const currentRunOf = <Run extends Pick<TaskRunResponseDto, 'state'>>(
  runs: readonly Run[],
): Run | null => {
  const [newest] = runs;

  return newest && !ENDED.has(newest.state) ? newest : null;
};

export type MockAsk = {
  readonly approval: boolean;
  readonly asksTheViewer: boolean;
};

const A_QUESTION: MockAsk = { approval: false, asksTheViewer: false };

const taskWaitsForTheViewer = (task: AskedTask, ask: MockAsk): boolean =>
  (task.awaitingReview ?? null) !== null &&
  ((task.assignee ?? null) === null ||
    task.assignee?.id === SAM.id ||
    ask.asksTheViewer);

const messageFromTheViewer = (
  task: AskedTask,
  running: boolean,
  to: Address,
  station: StationFacts,
  ask: MockAsk,
): YourMessage => {
  if (!to.atTaskStation) {
    return 'moved-on';
  }

  const hold = task.hold ?? null;
  const finished = task.finished ?? false;
  const awaiting =
    (task.awaitingReview ?? null) !== null && (to.currentRun || !running);

  if (awaiting && !ask.approval && (hold?.chatId ?? null) === null) {
    return taskWaitsForTheViewer(task, ask) || hold !== null
      ? 'answer'
      : 'awaits-another';
  }

  if (hold !== null) {
    return hold.chatId === null ? 'drives' : 'waits-for-chat';
  }

  if (
    !finished &&
    station.harnessed &&
    to.toRun &&
    ((task.awaitingReview ?? null) === null || ask.approval)
  ) {
    return 'holds';
  }

  return finished && !station.atCompleted ? 'reopens' : 'message';
};

const awaitsAPerson = (
  run: Pick<TaskRunResponseDto, 'state' | 'progress' | 'review'>,
  current: boolean,
): boolean =>
  (current && run.state === 'suspended' && run.progress === null) ||
  run.review?.state === 'pending';

export const seenByTheViewer = <
  Run extends Pick<
    TaskRunResponseDto,
    | 'state'
    | 'progress'
    | 'review'
    | 'station'
    | 'waitingForYou'
    | 'yourMessage'
    | 'stoppableByYou'
  >,
>(
  task: TaskResponseDto,
  runs: readonly Run[],
  stations: StationsFacts,
  ask: MockAsk = A_QUESTION,
): void => {
  const current = currentRunOf(runs);
  const running = current !== null;
  const station = stations(task.stationId);

  task.waitingForYou = taskWaitsForTheViewer(task, ask);
  task.yourMessage = messageFromTheViewer(
    task,
    running,
    TO_THE_TASK,
    station,
    ask,
  );

  for (const run of runs) {
    const holdsRun = run === current;

    run.waitingForYou =
      awaitsAPerson(run, holdsRun) && taskWaitsForTheViewer(task, ask);
    run.yourMessage = messageFromTheViewer(
      task,
      running,
      {
        toRun: true,
        currentRun: holdsRun,
        atTaskStation: run.station?.id === task.stationId,
      },
      station,
      ask,
    );
    run.stoppableByYou = run.station !== null;
  }
};

export const actedOnByTheViewer = (task: TaskResponseDto | undefined) => {
  if (task && task.assignee === null && task.hold === null) {
    task.assignee = SAM;
  }
};

export const reviewAnswered = (
  task: TaskResponseDto | undefined,
  runs: readonly TaskRunResponseDto[],
  conversationId: string,
): void => {
  if (task?.awaitingReview?.conversationId === conversationId) {
    actedOnByTheViewer(task);
    task.awaitingReview = null;
  }

  for (const run of runs) {
    if (run.review?.conversationId === conversationId) {
      run.review = { ...run.review, state: 'answered' };
    }
  }
};
