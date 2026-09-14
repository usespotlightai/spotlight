import { randomUUID } from 'node:crypto';
import { ListInboxHandler } from '@application/queries/handlers/list-inbox.handler';
import { ListInboxQuery } from '@application/queries/list-inbox.query';
import { settling } from '@domain/services/setup-list';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import type { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleInboxReader } from '@infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleRunnerReader } from '@infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import * as schema from '@infrastructure/persistence/drizzle/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { openTeam as opening } from './support/team';

const NOW = new Date('2026-01-02T03:04:05.000Z');

const DONE = {
  hasRunner: true,
  connectedToGitHub: true,
  hasRepository: true,
  hasConfiguration: true,
  listensToAnIntegration: true,
};

let held: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;

const openTeam = (slug: string) => opening(db, tasks, slug);

beforeAll(async () => {
  held = await openDatabase('setup');
  db = held.db;
  tasks = new DrizzleTaskRepository({ db } as unknown as DrizzleContext);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('the setup lists a team still has standing', () => {
  it('finds a team’s own, and says whose it is', async () => {
    const { teamId, list } = await openTeam('acme');

    const standing = await tasks.settingUpFor(teamId);

    expect(standing?.teamId).toEqual(teamId);
    expect(standing?.task.id).toEqual(list.id);
    expect(standing?.task.notes.map((each) => each.form)).toEqual(['setup']);
  });

  it('finds nothing for a team that has none', async () => {
    await expect(
      tasks.settingUpFor(TeamId.of(randomUUID())),
    ).resolves.toBeNull();
  });

  it('finds every one still standing', async () => {
    const mine = await openTeam('borden');
    const theirs = await openTeam('cutter');

    const standing = await tasks.settingUp();

    expect(standing.map((each) => each.teamId.value)).toEqual(
      expect.arrayContaining([mine.teamId.value, theirs.teamId.value]),
    );
  });

  it('leaves a settled one out', async () => {
    const { teamId, list } = await openTeam('fallon');

    const saying = settling(list.notes, DONE, NOW);
    const gone = list.settled(saying as NonNullable<typeof saying>);

    expect(gone.finishedAt).toBeNull();
    await tasks.save(gone);

    await expect(tasks.settingUpFor(teamId)).resolves.toBeNull();
    expect(
      (await tasks.settingUp()).map((each) => each.teamId.value),
    ).not.toContain(teamId.value);
  });

  it('keeps to the workspace it is asked about', async () => {
    const mine = await openTeam('hendricks');
    const theirs = await openTeam('sarah');

    const standing = await tasks.settingUpIn(mine.workspaceId);

    expect(standing.map((each) => each.teamId.value)).toEqual([
      mine.teamId.value,
    ]);
    expect(standing.map((each) => each.teamId.value)).not.toContain(
      theirs.teamId.value,
    );
  });

  it('keeps one somebody answered', async () => {
    const { teamId, list } = await openTeam('root');

    await tasks.save(
      list.answered(NotePosition.of(0), {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Working on it.'),
        at: NOW,
        voice: Voice.station(),
      }),
    );

    await expect(tasks.settingUpFor(teamId)).resolves.not.toBeNull();
  });

  it('leaves a task that never held a list out', async () => {
    const { workspaceId, teamId, stationId, list } = await openTeam('angier');

    await db.insert(schema.task).values({
      id: randomUUID(),
      workspaceId: workspaceId.value,
      stationId: stationId.value,
      title: 'Something else',
      rank: 'i',
    });

    await expect(tasks.settingUpFor(teamId)).resolves.toMatchObject({
      task: { id: list.id },
    });
  });
});

describe('the inbox item a setup list stands as', () => {
  const inbox = () =>
    new ListInboxHandler(new DrizzleInboxReader(db)).execute(
      new ListInboxQuery(waiting.slug, waiting.owner.value),
    );

  let waiting: Awaited<ReturnType<typeof openTeam>>;

  beforeAll(async () => {
    waiting = await openTeam('nolan');
  });

  it('stands owed while a step is still to be taken', async () => {
    const [item] = (await inbox()) ?? [];

    expect(item?.title).toBe('Set up your team');
    expect(item?.resolved).toBe(false);
  });

  it('reads as resolved once the list has been settled', async () => {
    const saying = settling(waiting.list.notes, DONE, NOW);

    await tasks.save(
      waiting.list.settled(saying as NonNullable<typeof saying>),
    );

    const [item] = (await inbox()) ?? [];

    expect(item?.resolved).toBe(true);
    expect(item?.notes[item.notes.length - 1]?.body).toBe(
      'Everything on this list is done.',
    );
  });
});

describe('whether a team has a runner', () => {
  const runners = () => new DrizzleRunnerReader(db);

  const enrol = async (given: {
    lastSeenAt?: Date | null;
    revokedAt?: Date | null;
  }) => {
    const id = randomUUID();

    await db.insert(schema.runner).values({
      id,
      name: id,
      tokenHash: id,
      lastSeenAt: given.lastSeenAt ?? null,
      revokedAt: given.revokedAt ?? null,
    });

    return id;
  };

  afterEach(async () => {
    await db.delete(schema.runner);
  });

  it('has none where none was ever enrolled', async () => {
    await expect(runners().anyConnected()).resolves.toBe(false);
  });

  it('has none where the only one has never checked in', async () => {
    await enrol({ lastSeenAt: null });

    await expect(runners().anyConnected()).resolves.toBe(false);
  });

  it('has none where the only one that checked in was taken away', async () => {
    await enrol({ lastSeenAt: NOW, revokedAt: NOW });

    await expect(runners().anyConnected()).resolves.toBe(false);
  });

  it('has one once something has checked in against its token', async () => {
    await enrol({ lastSeenAt: NOW });

    await expect(runners().anyConnected()).resolves.toBe(true);
  });

  it('finds it among ones that never came and ones that went', async () => {
    await enrol({ lastSeenAt: null });
    await enrol({ lastSeenAt: NOW, revokedAt: NOW });
    await enrol({ lastSeenAt: NOW });

    await expect(runners().anyConnected()).resolves.toBe(true);
  });
});
