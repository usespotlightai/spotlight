import { NoteByCallbackHandler } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { HookCallbacksPort } from '@integrations/application/ports/hook-callbacks.port';
import { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import { CallbackTaskHandler } from '@integrations/application/queries/handlers/callback-task.handler';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const HOLDER = {
  workspaceId: 'workspace_1',
  taskId: 'task_1',
  hook: 'dba-review',
};

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

const setUp = (held: typeof HOLDER | null, task = TASK) => {
  const callbacks: HookCallbacksPort = {
    minted: vi.fn(),
    heldBy: vi.fn(async () => held),
  };
  const tasks = {
    of: vi.fn(async () => task),
    ofPullRequest: vi.fn(),
  } satisfies HookedTasksPort;
  const notes = {
    noted: vi.fn(async () => true),
  } satisfies TaskNotesFromHooksPort;
  const clock = { now: () => NOW, sleep: async () => {} };

  return {
    tasks,
    notes,
    callbacks,
    reading: new CallbackTaskHandler(callbacks, tasks, clock),
    noting: new NoteByCallbackHandler(callbacks, notes, clock),
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
      noting.execute(new NoteByCallbackCommand('token', '  Looks safe.  ')),
    ).resolves.toBe('noted');
    expect(notes.noted).toHaveBeenCalledWith(
      'task_1',
      'Looks safe.',
      'dba-review',
    );
  });

  it('refuses an empty or overlong note, and an unknown token', async () => {
    const { noting } = setUp(HOLDER);
    const refused = setUp(null);

    await expect(
      noting.execute(new NoteByCallbackCommand('token', '   ')),
    ).resolves.toBe('empty');
    await expect(
      noting.execute(new NoteByCallbackCommand('token', 'x'.repeat(20_001))),
    ).resolves.toBe('empty');
    await expect(
      refused.noting.execute(new NoteByCallbackCommand('token', 'Hi')),
    ).resolves.toBe('refused');
  });
});
