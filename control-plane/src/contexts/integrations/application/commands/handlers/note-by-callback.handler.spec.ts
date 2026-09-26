import { NoteByCallbackHandler } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type {
  CallbackHolder,
  HookCallbacksPort,
} from '@integrations/application/ports/hook-callbacks.port';
import type { HookFiringsPort } from '@integrations/application/ports/hook-firings.port';
import { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import { CallbackTaskHandler } from '@integrations/application/queries/handlers/callback-task.handler';
import { causationInMemory } from '@shared-kernel/application/ports/causation.fake-spec';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const HOLDER: CallbackHolder = {
  workspaceId: 'workspace_1',
  taskId: 'task_1',
  hook: 'dba-review',
  firing: 'firing_1',
};

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

const setUp = (held: CallbackHolder | null, task = TASK) => {
  const callbacks: HookCallbacksPort = {
    minted: vi.fn(),
    heldBy: vi.fn(async () => held),
  };
  const tasks = {
    of: vi.fn(async () => task),
    ofPullRequest: vi.fn(),
  } satisfies HookedTasksPort;
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
  const firings = {
    chainOf: vi.fn(async () => FIRED),
  } as unknown as HookFiringsPort;
  const clock = { now: () => NOW, sleep: async () => {} };

  return {
    tasks,
    notes,
    callbacks,
    chains,
    reading: new CallbackTaskHandler(callbacks, tasks, clock),
    noting: new NoteByCallbackHandler(
      callbacks,
      notes,
      firings,
      causation,
      clock,
    ),
  };
};

describe('hook callbacks', () => {
  it('reads the one task the token was given for', async () => {
    const { reading, callbacks } = setUp(HOLDER);

    await expect(
      reading.execute(new CallbackTaskQuery('token')),
    ).resolves.toMatchObject({ id: 'task_1', hook: 'dba-review' });
    expect(callbacks.heldBy).toHaveBeenCalledWith('token', NOW);
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

  it('refuses an empty or overlong note, and an unknown token', async () => {
    const { noting } = setUp(HOLDER);
    const refused = setUp(null);

    await expect(
      noting.execute(new NoteByCallbackCommand('token', '   ', null)),
    ).resolves.toBe('empty');
    await expect(
      noting.execute(
        new NoteByCallbackCommand('token', 'x'.repeat(20_001), null),
      ),
    ).resolves.toBe('empty');
    await expect(
      refused.noting.execute(new NoteByCallbackCommand('token', 'Hi', null)),
    ).resolves.toBe('refused');
  });
});
