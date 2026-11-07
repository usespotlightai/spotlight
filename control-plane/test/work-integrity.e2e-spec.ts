import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { StationNotKnownYetError } from '@work/application/errors/station-not-known-yet.error';
import { ReleaseTakenMarks } from '@work/application/events/handlers/release-taken-marks.handler';
import type { ProjectedLine } from '@work/application/ports/work-stations.port';
import { correlatedTask } from '@work/application/services/correlated-task';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskMarked } from '@work/domain/events/task-marked.event';
import { AttachmentHeldElsewhereError } from '@work/domain/exceptions/attachment-held-elsewhere.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { Station } from '@work/domain/value-objects/station.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { DrizzleWorkStations } from '@work/infrastructure/persistence/drizzle/projections/work-stations.projection';
import { DrizzleAttachmentReader } from '@work/infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleStationDeletionGuard } from '@work/infrastructure/persistence/drizzle/station-deletion.guard';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

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
  line: LineMap,
  at: StationId,
  over: {
    attachments?: readonly Attachment[];
    marks?: readonly Mark[];
    markedAt?: Date;
  } = {},
): Task => {
  const task = (over.marks ?? []).reduce(
    (each, mark) => each.markedBy(mark, over.markedAt ?? NOW),
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
    const team = await createTeam(db, tasks, `review-${randomUUID()}`);
    const reviewId = StationId.of(randomUUID());
    const [backlog, completed] = team.line.stations as [Station, Station];

    await db
      .update(schema.station)
      .set({ position: 2 })
      .where(eq(schema.station.id, completed.id.value));

    await insertStations(db, {
      id: reviewId.value,
      workspaceId: team.workspaceId.value,
      lineId: team.line.id.value,
      key: 'code-review',
      name: 'Review',
      position: 1,
    });

    const whole = LineMap.of({
      id: team.line.id,
      workspaceId: team.line.workspaceId,
      teamId: team.line.teamId,
      key: team.line.key,
      name: team.line.name,
      stations: [
        backlog,
        Station.of({
          id: reviewId,
          key: StationKey.of('code-review'),
          name: StationName.of('Review'),
          kind: 'work',
          position: 1,
        }),
        Station.of({
          id: completed.id,
          key: completed.key,
          name: completed.name,
          kind: 'completed',
          position: 2,
        }),
      ],
    });

    return { whole, reviewId };
  };

  it('is held while a task is at the station, and keeps the task', async () => {
    const { whole, reviewId } = await withReview();
    const task = added(whole, reviewId);
    await tasks.add(task);

    await expect(
      context.inTransaction(() =>
        new DrizzleStationDeletionGuard(context).release([reviewId]),
      ),
    ).rejects.toThrow();
    await expect(tasks.find(task.id)).resolves.not.toBeNull();
  });

  it('counts the tasks at each station while it locks the stations', async () => {
    const { whole, reviewId } = await withReview();
    await tasks.add(added(whole, reviewId));

    const tally = await context.inTransaction(() =>
      new DrizzleStationDeletionGuard(context).lockedTaskCountsAt(
        { lineId: whole.id, version: 1 },
        [reviewId],
      ),
    );

    expect(tally).toEqual([{ stationId: reviewId, tasks: 1 }]);
  });

  it('rejects a task at a station that is released', async () => {
    const { whole, reviewId } = await withReview();

    await expect(
      context.inTransaction(() =>
        new DrizzleStationDeletionGuard(context).release([reviewId]),
      ),
    ).resolves.toBeUndefined();
    await expect(tasks.add(added(whole, reviewId))).rejects.toBeInstanceOf(
      StationNotKnownYetError,
    );
  });
});

describe('the stations Work knows of a line', () => {
  const projected = (
    lineId: LineId,
    version: number,
    stationIds: readonly StationId[],
  ): ProjectedLine => ({
    lineId,
    workspaceId: WorkspaceId.of('ws_projection'),
    teamId: TeamId.of('team_projection'),
    version,
    key: 'delivery',
    name: 'Delivery',
    stations: stationIds.map((id, position) => ({
      id,
      key: `station-${position}`,
      name: `Station ${position}`,
      kind: 'work',
      color: '#6d78d5',
      position,
    })),
  });

  const known = async (lineId: LineId) =>
    (
      await db
        .select({ id: schema.workStation.stationId })
        .from(schema.workStation)
        .where(eq(schema.workStation.lineId, lineId.value))
    )
      .map((each) => each.id)
      .sort();

  it('follows the newest change of the line and drops the stations it no longer has', async () => {
    const stations = new DrizzleWorkStations(context);
    const lineId = LineId.of(randomUUID());
    const [kept, dropped] = [randomUUID(), randomUUID()].map(StationId.of) as [
      StationId,
      StationId,
    ];

    await stations.project(projected(lineId, 0, [kept, dropped]));
    await stations.project(projected(lineId, 1, [kept]));

    expect(await known(lineId)).toEqual([kept.value]);
  });

  it('ignores a change older than one it already followed, also after the line is deleted', async () => {
    const stations = new DrizzleWorkStations(context);
    const lineId = LineId.of(randomUUID());
    const station = StationId.of(randomUUID());

    await stations.project(projected(lineId, 3, []));
    await stations.project(projected(lineId, 0, [station]));

    expect(await known(lineId)).toEqual([]);
  });

  it('keeps a station out that a change saved before the line was first followed released', async () => {
    const stations = new DrizzleWorkStations(context);
    const guard = new DrizzleStationDeletionGuard(context);
    const lineId = LineId.of(randomUUID());
    const [kept, dropped] = [randomUUID(), randomUUID()].map(StationId.of) as [
      StationId,
      StationId,
    ];

    await context.inTransaction(async () => {
      await guard.lockedTaskCountsAt({ lineId, version: 1 }, [kept, dropped]);
      await guard.release([dropped]);
    });
    await stations.project(projected(lineId, 0, [kept, dropped]));

    expect(await known(lineId)).toEqual([]);

    await stations.project(projected(lineId, 1, [kept]));

    expect(await known(lineId)).toEqual([kept.value]);
  });
});

describe('a mark that one task has and another task claims', () => {
  it('finds the newest holder while the older one still holds it, and releases it from the older one', async () => {
    const { line, stationId, workspaceId } = await createTeam(
      db,
      tasks,
      `n-${randomUUID()}`,
    );
    const thread = Mark.of('slack.thread', randomUUID());
    const before = added(line, stationId, {
      marks: [thread],
      markedAt: new Date('2026-09-17T09:00:00.000Z'),
    });
    await tasks.add(before);

    const newest = added(line, stationId, {
      marks: [thread],
      markedAt: new Date('2026-09-17T10:00:00.000Z'),
    });
    await tasks.add(newest);

    const correlationKeys = CorrelationKeys.of({
      marks: [thread],
    }) as CorrelationKeys;
    await expect(
      context.inTransaction(() =>
        correlatedTask(tasks, workspaceId, correlationKeys),
      ),
    ).resolves.toMatchObject({ id: newest.id });

    await new ReleaseTakenMarks(tasks, context).on(
      new TaskMarked(newest.id, workspaceId, thread),
    );

    expect((await tasks.find(before.id))?.marks).toEqual([]);
    expect((await tasks.find(before.id))?.version).toBe(before.version + 1);
    expect((await tasks.find(newest.id))?.marks).toEqual([thread]);
    await expect(tasks.holdingMark(workspaceId, thread)).resolves.toHaveLength(
      1,
    );
  });
});

describe('a file handed over twice', () => {
  it('stays with the task it was first attached to', async () => {
    const { line, stationId } = await createTeam(
      db,
      tasks,
      `a-${randomUUID()}`,
    );
    const attachment = file();
    const first = added(line, stationId, { attachments: [attachment] });
    await tasks.add(first);

    await expect(
      tasks.add(added(line, stationId, { attachments: [attachment] })),
    ).rejects.toBeInstanceOf(AttachmentHeldElsewhereError);
    await expect(
      new DrizzleAttachmentReader(db).find(attachment.id.value),
    ).resolves.toMatchObject({ id: attachment.id.value });
  });

  it('lets its holder be written again', async () => {
    const { line, stationId, owner } = await createTeam(
      db,
      tasks,
      `b-${randomUUID()}`,
    );
    const first = added(line, stationId, { attachments: [file()] });
    await tasks.add(first);

    const again = (await tasks.find(first.id)) as Task;

    await expect(
      tasks.save(again.assign(owner, TeamMembers.of([owner]))),
    ).resolves.toBeUndefined();
  });

  it('cannot be attached to a chat once a task has it', async () => {
    const { line, stationId, workspaceId, teamId, owner } = await createTeam(
      db,
      tasks,
      `c-${randomUUID()}`,
    );
    const attachment = file();
    await tasks.add(added(line, stationId, { attachments: [attachment] }));

    const chat = Chat.start({
      lines: [],
      workspaceId,
      teamId,
      startedBy: owner,
      harness: HarnessId.of('dev'),
      body: ChatMessageBody.of('Plan the queue.'),
      attachments: [attachment],
      now: NOW,
      newId: () => randomUUID(),
    });

    await expect(
      new DrizzleChatRepository(context, quiet).add(chat),
    ).rejects.toBeInstanceOf(AttachmentHeldElsewhereError);
  });
});

describe('a chat dispatched to a run', () => {
  it('remembers the run that acknowledged each message, until the message is unacknowledged', async () => {
    const { workspaceId, teamId, owner } = await createTeam(
      db,
      tasks,
      `h-${randomUUID()}`,
    );
    const chats = new DrizzleChatRepository(context, quiet);
    const started = Chat.start({
      lines: [],
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

    await chats.save(dispatched.runEndedWithoutSession(run));
    const back = (await chats.find(started.id)) as Chat;

    expect(back.running).toBe(false);
    expect(back.unacknowledged).toHaveLength(1);
    expect(back.messages[0]?.wasAcknowledgedBy(run)).toBe(false);
  });
});
