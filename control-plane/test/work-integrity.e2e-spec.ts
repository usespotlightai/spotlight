import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { takeTaskMarks } from '@work/application/services/task-marks';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { MarkAlreadyClaimedError } from '@work/domain/exceptions/mark-already-claimed.error';
import { StrandedWorkError } from '@work/domain/exceptions/stranded-work.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleAttachmentReader } from '@work/infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleStationTallies } from '@work/infrastructure/persistence/drizzle/readers/station-tallies.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const NOW = new Date('2026-09-17T09:00:00.000Z');
const quiet = { dispatch: async () => {} };

let database: TestDatabase;
let db: DrizzleDatabase;
let context: DrizzleContext;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  database = await openDatabase('work_integrity');
  db = database.db;
  context = new DrizzleContext(db);
  tasks = new DrizzleTaskRepository(context, quiet);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const added = (
  line: Line,
  at: StationId,
  over: { attachments?: readonly Attachment[]; marks?: readonly Mark[] } = {},
): Task => {
  const task = (over.marks ?? []).reduce(
    (each, mark) => each.markedBy(mark),
    Task.add({
      line,
      at,
      title: TaskTitle.of('Drain the queue'),
      rank: TaskRank.of('i'),
      attachments: over.attachments,
      now: NOW,
      newId: () => randomUUID(),
    }),
  );
  task.pullEvents();

  return task;
};

const file = (id = randomUUID()) =>
  Attachment.of({ id, name: 'queue.png', contentType: 'image/png', size: 1 });

describe('a line that drops a station', () => {
  const withReview = async () => {
    const team = await openTeam(db, tasks, `review-${randomUUID()}`);
    const reviewId = StationId.of(randomUUID());
    const [backlog, completed] = team.line.stations;
    const closing = Station.of({
      id: completed.id,
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: StationColor.plain(),
      kind: 'completed',
    });

    await db
      .update(schema.station)
      .set({ position: 2 })
      .where(eq(schema.station.id, completed.id.value));

    await db.insert(schema.station).values({
      id: reviewId.value,
      lineId: team.line.id.value,
      key: 'code-review',
      name: 'Review',
      position: 1,
    });

    const review = Station.of({
      id: reviewId,
      key: StationKey.of('code-review'),
      name: StationName.of('Review'),
      position: 1,
      color: StationColor.plain(),
      kind: 'work',
    });
    const whole = Line.rehydrate({
      id: team.line.id,
      workspaceId: team.line.workspaceId,
      teamId: team.line.teamId,
      key: team.line.key,
      name: team.line.name,
      stations: [backlog, review, closing],
    });
    const without = Line.rehydrate({
      id: team.line.id,
      workspaceId: team.line.workspaceId,
      teamId: team.line.teamId,
      key: team.line.key,
      name: team.line.name,
      stations: [backlog, completed],
    });

    return { whole, without, reviewId };
  };

  it('does not drop a station that still has work, and keeps the work', async () => {
    const { whole, without, reviewId } = await withReview();
    const task = added(whole, reviewId);
    await tasks.add(task);

    await expect(
      new DrizzleLineRepository(context, quiet).save(without),
    ).rejects.toBeInstanceOf(StrandedWorkError);
    await expect(tasks.find(task.id)).resolves.not.toBeNull();
  });

  it('counts the tasks at each station while it locks the stations', async () => {
    const { whole, reviewId } = await withReview();
    await tasks.add(added(whole, reviewId));

    const tally = await context.inTransaction(() =>
      new DrizzleStationTallies(context).lockedTaskCountsAt([reviewId]),
    );

    expect(tally.get(reviewId.value)).toBe(1);
  });

  it('rejects a task at a station that is gone', async () => {
    const { whole, without, reviewId } = await withReview();
    await new DrizzleLineRepository(context, quiet).save(without);

    await expect(tasks.add(added(whole, reviewId))).rejects.toBeInstanceOf(
      UnknownStationError,
    );
  });
});

describe('a mark that one task has and another task claims', () => {
  it('rejects a claim that skips the task with the mark', async () => {
    const { line, stationId } = await openTeam(db, tasks, `m-${randomUUID()}`);
    const thread = Mark.of('slack.thread', randomUUID());

    await tasks.add(added(line, stationId, { marks: [thread] }));

    await expect(
      tasks.add(added(line, stationId, { marks: [thread] })),
    ).rejects.toBeInstanceOf(MarkAlreadyClaimedError);
  });

  it('passes to the newest claim through the task that had the mark', async () => {
    const { line, stationId, workspaceId } = await openTeam(
      db,
      tasks,
      `n-${randomUUID()}`,
    );
    const thread = Mark.of('slack.thread', randomUUID());
    const before = added(line, stationId, { marks: [thread] });
    await tasks.add(before);

    const newest = added(line, stationId, { marks: [thread] });
    await context.inTransaction(async () => {
      await takeTaskMarks(tasks, newest);
      await tasks.add(newest);
    });

    const concerns = Concerns.of({ marks: [thread] }) as Concerns;
    await expect(
      tasks.findByMarks(workspaceId, concerns),
    ).resolves.toMatchObject({
      id: newest.id,
    });
    expect((await tasks.find(before.id))?.marks).toEqual([]);
    expect((await tasks.find(before.id))?.version).toBe(before.version + 1);
  });
});

describe('a file handed over twice', () => {
  it('stays with the task it was first given to', async () => {
    const { line, stationId } = await openTeam(db, tasks, `a-${randomUUID()}`);
    const given = file();
    const first = added(line, stationId, { attachments: [given] });
    await tasks.add(first);

    await expect(
      tasks.add(added(line, stationId, { attachments: [given] })),
    ).rejects.toBeInstanceOf(InvalidAttachmentError);
    await expect(
      new DrizzleAttachmentReader(db).find(given.id.value),
    ).resolves.toMatchObject({ id: given.id.value });
  });

  it('lets its holder be written again', async () => {
    const { line, stationId, owner } = await openTeam(
      db,
      tasks,
      `b-${randomUUID()}`,
    );
    const first = added(line, stationId, { attachments: [file()] });
    await tasks.add(first);

    const again = (await tasks.find(first.id)) as Task;

    await expect(tasks.save(again.assign(owner))).resolves.toBeUndefined();
  });

  it('cannot be given to a chat once a task has it', async () => {
    const { line, stationId, workspaceId, teamId, owner } = await openTeam(
      db,
      tasks,
      `c-${randomUUID()}`,
    );
    const given = file();
    await tasks.add(added(line, stationId, { attachments: [given] }));

    const chat = Chat.start({
      workspaceId,
      teamId,
      startedBy: owner,
      harness: HarnessId.of('dev'),
      body: ChatMessageBody.of('Plan the queue.'),
      attachments: [given],
      now: NOW,
      newId: () => randomUUID(),
    });

    await expect(
      new DrizzleChatRepository(context, quiet).add(chat),
    ).rejects.toBeInstanceOf(InvalidAttachmentError);
  });
});

describe('a chat dispatched to a run', () => {
  it('remembers the run that acknowledged each message, until the message is unacknowledged', async () => {
    const { workspaceId, teamId, owner } = await openTeam(
      db,
      tasks,
      `h-${randomUUID()}`,
    );
    const chats = new DrizzleChatRepository(context, quiet);
    const started = Chat.start({
      workspaceId,
      teamId,
      startedBy: owner,
      harness: HarnessId.of('dev'),
      body: ChatMessageBody.of('Plan the queue.'),
      now: NOW,
      newId: () => randomUUID(),
    });
    started.pullEvents();
    await chats.add(started);

    const run = RunId.of(randomUUID());
    await chats.save(started.assignRun(run, NOW));
    const dispatched = (await chats.find(started.id)) as Chat;

    expect(dispatched.messages[0]?.wasAcknowledgedBy(run)).toBe(true);

    await chats.save(dispatched.runKeptNothing(run));
    const back = (await chats.find(started.id)) as Chat;

    expect(back.running).toBe(false);
    expect(back.unacknowledged).toHaveLength(1);
    expect(back.messages[0]?.wasAcknowledgedBy(run)).toBe(false);
  });
});
