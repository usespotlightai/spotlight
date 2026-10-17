import { randomUUID } from 'node:crypto';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { DrizzleIdentityResources } from '@identity/infrastructure/persistence/drizzle/readers/identity-resources.reader';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleViewableWorkspaces } from '@identity/infrastructure/persistence/drizzle/readers/viewable-workspaces.reader';
import { DrizzleWorkspaceReader } from '@identity/infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleTeamRepository } from '@identity/infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { SystemClock } from '@platform/time/system-clock';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxItemDto } from '@work/application/dto/inbox.dto';
import { ListInboxHandler } from '@work/application/queries/handlers/list-inbox.handler';
import { ListInboxQuery } from '@work/application/queries/list-inbox.query';
import { setupDoneNote } from '@work/domain/services/setup-list';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { openTeam as opening } from './support/team';

const access = (db: DrizzleDatabase) =>
  new WorkspaceAccess(
    new DrizzleViewableWorkspaces(db),
    new DrizzleWorkspaceRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }),
    new DrizzleIdentityResources(new DrizzleContext(db)),
    new DrizzleTeamRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }),
  );

const NOW = new Date('2026-01-02T03:04:05.000Z');

const DONE = {
  connectedToGitHub: true,
  hasHarness: true,
  configured: true,
};

let database: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;

const openTeam = (slug: string) => opening(db, tasks, slug);

beforeAll(async () => {
  database = await openDatabase('setup');
  db = database.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the open setup lists of a team', () => {
  it('finds a team’s own', async () => {
    const { teamId, list } = await openTeam('acme');

    const open = await tasks.settingUpFor(teamId);

    expect(open?.id).toEqual(list.id);
    expect(open?.notes.map((each) => each.form)).toEqual(['setup']);
  });

  it('finds nothing for a team that has none', async () => {
    await expect(
      tasks.settingUpFor(TeamId.of(randomUUID())),
    ).resolves.toBeNull();
  });

  it('finds every open one', async () => {
    const mine = await openTeam('borden');
    const theirs = await openTeam('cutter');

    const open = await tasks.settingUp();

    expect(open.map((each) => each.id.value)).toEqual(
      expect.arrayContaining([mine.list.id.value, theirs.list.id.value]),
    );
  });

  it('leaves a closed one out', async () => {
    const { teamId, list } = await openTeam('fallon');

    const saying = setupDoneNote(list.notes, DONE, NOW);
    const gone = list.closeConversation(saying as NonNullable<typeof saying>);

    expect(gone.finishedAt).toBeNull();
    await tasks.save(gone);

    await expect(tasks.settingUpFor(teamId)).resolves.toBeNull();
    expect(
      (await tasks.settingUp()).map((each) => each.id.value),
    ).not.toContain(list.id.value);
  });

  it('keeps to the workspace it is asked about', async () => {
    const mine = await openTeam('hendricks');
    const theirs = await openTeam('sarah');

    const open = await tasks.settingUpIn(mine.workspaceId);

    expect(open.map((each) => each.id.value)).toEqual([mine.list.id.value]);
    expect(open.map((each) => each.id.value)).not.toContain(
      theirs.list.id.value,
    );
  });

  it('keeps one somebody answered', async () => {
    const { teamId, list } = await openTeam('root');

    await tasks.save(
      list.answer(NotePosition.of(0), {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Working on it.'),
        at: NOW,
        voice: Voice.station(),
      }),
    );

    await expect(tasks.settingUpFor(teamId)).resolves.not.toBeNull();
  });

  it('leaves out a task that never had a list', async () => {
    const { workspaceId, teamId, stationId, list } = await openTeam('angier');

    await db.insert(schema.task).values({
      id: randomUUID(),
      openedFrom: 'person',
      workspaceId: workspaceId.value,
      stationId: stationId.value,
      title: 'Something else',
      rank: 'i',
    });

    await expect(tasks.settingUpFor(teamId)).resolves.toMatchObject({
      id: list.id,
    });
  });
});

describe('the inbox item of a setup list', () => {
  const inbox = () =>
    new ListInboxHandler(
      new DrizzleInboxReader(
        db,
        access(db),
        new DrizzleWorkspaceReader(db),
        new DrizzlePersonReader(db),
      ),
      new SystemClock(),
    )
      .execute(new ListInboxQuery(waiting.slug, waiting.owner.value))
      .then((entries) =>
        (entries ?? []).filter(
          (each): each is InboxItemDto => each.kind === 'task',
        ),
      );

  let waiting: Awaited<ReturnType<typeof openTeam>>;

  beforeAll(async () => {
    waiting = await openTeam('nolan');
  });

  it('is owed while a step is still to be taken', async () => {
    const [item] = await inbox();

    expect(item?.title).toBe('Set up your team');
    expect(item?.resolved).toBe(false);
  });

  it('reads as resolved once the list has been closed', async () => {
    const saying = setupDoneNote(waiting.list.notes, DONE, NOW);

    await tasks.save(
      waiting.list.closeConversation(saying as NonNullable<typeof saying>),
    );

    const [item] = await inbox();

    expect(item?.resolved).toBe(true);
    expect(item?.notes[item.notes.length - 1]?.body).toBe(
      'Everything on this list is done.',
    );
  });
});

describe('whether a workspace is ready to run', () => {
  const runners = () =>
    new DrizzleRunnerReader(
      db,
      {
        now: () => NOW,
        sleep: async () => {},
      },
      true,
    );

  const pooled = async (workspaceId: WorkspaceId, mode: 'pull' | 'push') => {
    const id = randomUUID();

    await db.insert(schema.runnerPool).values({
      id,
      workspaceId: workspaceId.value,
      key: `pool-${randomUUID().slice(0, 8)}`,
      ...(mode === 'pull'
        ? { tokenHash: randomUUID().replaceAll('-', '').repeat(2) }
        : {
            provisionUrl: 'https://provision.example.com/runs',
            provisionSecret: 'sealed',
          }),
    });

    return id;
  };

  const trusted = (workspaceId: WorkspaceId) =>
    db.insert(schema.runnerTrust).values({
      id: randomUUID(),
      workspaceId: workspaceId.value,
      key: `trust-${randomUUID().slice(0, 8)}`,
      issuer: 'https://oidc.example.com/cluster',
      subject: 'system:serviceaccount:spotlight:runner',
      audience: 'spotlight',
    });

  const SERVING = {
    image: 'ghcr.io/usespotlightai/spotlight-runner:1.0.0',
    isDefault: true,
    harnesses: [{ id: 'claude-code', models: [] }],
  };

  const hosted = async (
    workspaceId: WorkspaceId,
    over: {
      images?: (typeof schema.runnerHost.$inferInsert)['images'];
      lastHeartbeatAt?: Date;
    } = {},
  ) =>
    db.insert(schema.runnerHost).values({
      id: randomUUID(),
      workspaceId: workspaceId.value,
      poolId: await pooled(workspaceId, 'pull'),
      bootId: 'boot_1',
      name: 'build-box',
      release: '1.0.0',
      containerRuntime: 'docker',
      capacity: 1,
      images: over.images ?? [SERVING],
      firstHeartbeatAt: over.lastHeartbeatAt ?? NOW,
      onlineSince: over.lastHeartbeatAt ?? NOW,
      lastHeartbeatAt: over.lastHeartbeatAt ?? NOW,
    });

  afterEach(async () => {
    await db.delete(schema.runnerHost);
    await db.delete(schema.runnerPool);
    await db.delete(schema.runnerTrust);
  });

  it('is not ready with neither a pool, a trust nor a host', async () => {
    await expect(
      runners().readyToRun(WorkspaceId.of(randomUUID())),
    ).resolves.toBe(false);
  });

  it('is not ready with only a pull pool or a runner trust, before any host sends a heartbeat', async () => {
    const workspace = WorkspaceId.of(randomUUID());

    await pooled(workspace, 'pull');
    await trusted(workspace);

    await expect(runners().readyToRun(workspace)).resolves.toBe(false);
  });

  it('is ready with a push pool, which starts its runners on demand', async () => {
    const workspace = WorkspaceId.of(randomUUID());

    await pooled(workspace, 'push');

    await expect(runners().readyToRun(workspace)).resolves.toBe(true);
  });

  it('is ready once a host sends a heartbeat that reports a harness', async () => {
    const workspace = WorkspaceId.of(randomUUID());

    await hosted(workspace);

    await expect(runners().readyToRun(workspace)).resolves.toBe(true);
  });

  it('is not ready with a host whose images serve no harness', async () => {
    const workspace = WorkspaceId.of(randomUUID());

    await hosted(workspace, {
      images: [
        { ...SERVING, unavailableReason: 'pull access denied' },
        {
          ...SERVING,
          image: 'ghcr.io/acme/bare:1',
          isDefault: false,
          harnesses: [],
        },
      ],
    });

    await expect(runners().readyToRun(workspace)).resolves.toBe(false);
  });

  it('is not ready with a host whose last heartbeat is more than a day old', async () => {
    const workspace = WorkspaceId.of(randomUUID());

    await hosted(workspace, {
      lastHeartbeatAt: new Date(NOW.getTime() - 24 * 60 * 60_000),
    });

    await expect(runners().readyToRun(workspace)).resolves.toBe(false);
  });

  it('does not count a host or push pool in another workspace', async () => {
    const mine = WorkspaceId.of(randomUUID());
    const theirs = WorkspaceId.of(randomUUID());

    await hosted(theirs);
    await pooled(theirs, 'push');

    await expect(runners().readyToRun(mine)).resolves.toBe(false);
  });
});
