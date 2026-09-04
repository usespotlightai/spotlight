import { TaskMovedOnError } from '@domain/exceptions/task-moved-on.error';
import { settling } from '@domain/services/setup-list';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import type { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { openTeam } from './support/team';

const NOW = new Date('2026-01-02T03:04:05.000Z');

const DONE = {
  hasRunner: true,
  connectedToGitHub: true,
  hasRepository: true,
  hasConfiguration: true,
  listensToATool: true,
};

let held: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  held = await openDatabase('task_writes');
  db = held.db;
  tasks = new DrizzleTaskRepository({ db } as unknown as DrizzleContext);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

/**
 * A task is saved whole rather than field by field, so a writer working from
 * an older reading writes its own idea of it over what somebody else put
 * there.
 */
describe('writing a task somebody else has written', () => {
  const opened = async () => {
    const { list } = await openTeam(db, tasks, `nolan-${randomUUID()}`);
    const id = list.id;

    const one = await tasks.find(id);
    const other = await tasks.find(id);

    if (!one || !other) {
      throw new Error('the task that was just added could not be read back');
    }

    return { one, other };
  };

  const settled = (task: NonNullable<Awaited<ReturnType<typeof tasks.find>>>) =>
    task.settled({
      station: StationName.of('Backlog'),
      body: TaskNoteBody.of('Everything on this list is done.'),
      at: NOW,
      voice: Voice.station(),
    });

  it('takes the first of them', async () => {
    const { one } = await opened();

    await expect(tasks.save(settled(one))).resolves.toBeUndefined();
  });

  it('refuses the second, rather than laying it over the first', async () => {
    const { one, other } = await opened();

    await tasks.save(one.handedTo(RunId.of(randomUUID())));

    await expect(tasks.save(settled(other))).rejects.toBeInstanceOf(
      TaskMovedOnError,
    );
  });

  it('leaves what the first writer put there', async () => {
    const { one, other } = await opened();
    const runId = RunId.of(randomUUID());

    await tasks.save(one.handedTo(runId));
    await tasks.save(settled(other)).catch(() => {});

    const read = await tasks.find(one.id);

    expect(read?.currentRunId?.value).toBe(runId.value);
  });

  it('takes the same change once it is read again', async () => {
    const { one, other } = await opened();

    await tasks.save(one.handedTo(RunId.of(randomUUID())));
    await tasks.save(settled(other)).catch(() => {});

    const again = await tasks.find(one.id);
    const saying = settling(again?.notes ?? [], DONE, NOW);

    await expect(
      tasks.save((again as NonNullable<typeof again>).settled(
        saying as NonNullable<typeof saying>,
      )),
    ).resolves.toBeUndefined();
  });

  it('refuses a second write from the same reading', async () => {
    const { one } = await opened();

    await tasks.save(settled(one));

    await expect(
      tasks.save(one.handedTo(RunId.of(randomUUID()))),
    ).rejects.toBeInstanceOf(TaskMovedOnError);
  });
});
