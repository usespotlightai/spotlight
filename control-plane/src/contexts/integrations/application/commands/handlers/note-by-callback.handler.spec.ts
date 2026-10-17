import { NoteByCallbackHandler } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { TasksForHooksPort } from '@integrations/application/ports/tasks-for-hooks.port';
import { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import { CallbackTaskHandler } from '@integrations/application/queries/handlers/callback-task.handler';
import { HookCallbackGrants } from '@integrations/application/services/hook-callback-grants.service';
import { HookCallbackGrant } from '@integrations/domain/aggregates/hook-callback-grant.aggregate';
import type { HookCallbackGrantRepository } from '@integrations/domain/repositories/hook-callback-grant.repository';
import { causationInMemory } from '@shared-kernel/application/ports/causation.fake-spec';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const HASH = TokenHash.of('a'.repeat(64));

const HOLDER = HookCallbackGrant.issueFor(
  {
    tokenHash: HASH,
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: TaskId.of('task_1'),
    hook: 'dba-review',
    firing: 'firing_1',
  },
  NOW,
);

const FIRED = CausalChain.none().followedBy({
  kind: 'hook',
  key: 'hook:dba_id:task.moved:task_1:build → review',
  saying: 'the hook dba-review',
});

const TASK = {
  taskId: 'task_1',
  workspaceId: 'workspace_1',
  teamId: 'team_1',
  title: 'Add a column',
  url: 'https://spotlight.example.com/t/1',
  line: 'delivery',
  station: 'Implementation',
  stationKey: 'implementation',
  marks: {},
  repositories: ['acme/api'],
  pullRequest: null,
  runId: null,
};

const setUp = (
  grant: HookCallbackGrant | null,
  task = TASK,
  now: Date = NOW,
) => {
  const kept = {
    add: vi.fn(async () => {}),
    withToken: vi.fn(async () => grant),
    forgetExpiringBefore: vi.fn(async () => {}),
  } satisfies HookCallbackGrantRepository;
  const clock = { now: () => now, sleep: async () => {} };
  const callbacks = new HookCallbackGrants(
    kept,
    {
      mint: () => ({ token: 'token', hash: HASH.value }),
      hash: () => HASH.value,
    },
    clock,
  );
  const tasks = {
    of: vi.fn(async () => task),
    ofPullRequest: vi.fn(),
  } satisfies TasksForHooksPort;
  const causation = causationInMemory();
  const chains: string[] = [];
  const notes = {
    noted: vi.fn(async () => {
      chains.push(causation.current().saying);
      return true;
    }),
    failed: vi.fn(async () => 'reported' as const),
    movedOn: vi.fn(async () => false),
  } satisfies TaskNotesFromHooksPort;
  const history = {
    recentRepeats: vi.fn(),
    chainOf: vi.fn(async () => FIRED),
  } satisfies HookFiringHistoryPort;

  return {
    tasks,
    notes,
    kept,
    chains,
    reading: new CallbackTaskHandler(callbacks, tasks),
    noting: new NoteByCallbackHandler(callbacks, notes, history, causation),
  };
};

describe('hook callbacks', () => {
  it('reads the one task the token was given for', async () => {
    const { reading, kept } = setUp(HOLDER);

    await expect(
      reading.execute(new CallbackTaskQuery('token')),
    ).resolves.toMatchObject({ id: 'task_1', hook: 'dba-review' });
    expect(kept.withToken).toHaveBeenCalledWith(HASH);
  });

  it('reads nothing once the token has expired', async () => {
    const { reading } = setUp(
      HOLDER,
      TASK,
      new Date(NOW.getTime() + 15 * 60_000),
    );

    await expect(
      reading.execute(new CallbackTaskQuery('token')),
    ).resolves.toBeNull();
  });

  it('reads nothing for an unknown or spent token', async () => {
    const { reading } = setUp(null);

    await expect(
      reading.execute(new CallbackTaskQuery('token')),
    ).resolves.toBeNull();
  });

  it('reads nothing when the task moved to another workspace', async () => {
    const { reading } = setUp(HOLDER, { ...TASK, workspaceId: 'workspace_2' });

    await expect(
      reading.execute(new CallbackTaskQuery('token')),
    ).resolves.toBeNull();
  });

  it('notes on the task as the hook', async () => {
    const { noting, notes } = setUp(HOLDER);

    await expect(
      noting.execute(
        new NoteByCallbackCommand('token', '  Looks safe.  ', null),
      ),
    ).resolves.toBe('noted');
    expect(notes.noted).toHaveBeenCalledWith(
      'task_1',
      'Looks safe.',
      'dba-review',
      null,
    );
  });

  it('notes once however often a note with one idempotency key is retried', async () => {
    const { noting, notes } = setUp(HOLDER);

    await noting.execute(new NoteByCallbackCommand('token', 'Safe.', 'note-7'));

    expect(notes.noted).toHaveBeenCalledWith(
      'task_1',
      'Safe.',
      'dba-review',
      'callback:task_1:firing_1:note-7',
    );
  });

  it('notes in the chain of causes of the firing that asked for it', async () => {
    const { noting, chains } = setUp(HOLDER);

    await noting.execute(new NoteByCallbackCommand('token', 'Safe.', null));

    expect(chains).toEqual([
      'the hook dba-review → a note by callback from the hook dba-review',
    ]);
  });

  it('rejects an empty or overlong note, and an unknown token', async () => {
    const { noting } = setUp(HOLDER);
    const rejected = setUp(null);

    await expect(
      noting.execute(new NoteByCallbackCommand('token', '   ', null)),
    ).resolves.toBe('empty');
    await expect(
      noting.execute(
        new NoteByCallbackCommand('token', 'x'.repeat(20_001), null),
      ),
    ).resolves.toBe('empty');
    await expect(
      rejected.noting.execute(new NoteByCallbackCommand('token', 'Hi', null)),
    ).resolves.toBe('rejected');
  });
});
