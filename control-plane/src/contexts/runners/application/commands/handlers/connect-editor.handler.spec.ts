import { ConnectEditorHandler } from '@runners/application/commands/handlers/connect-editor.handler';
import { ConnectEditorCommand } from '@runners/application/commands/sandbox-editor.commands';
import type { EditorAccessPort } from '@runners/application/ports/editor-access.port';
import type { EditorSandboxesPort } from '@runners/application/ports/editor-sandboxes.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T10:00:00.000Z');

const setUp = (input: { held?: boolean[] } = {}) => {
  const access = {
    editorAccessFor: vi.fn(async (personId: string) =>
      personId === 'user_bea'
        ? { workspaceId: 'ws_1', key: 'task-task_1' }
        : null,
    ),
  } satisfies EditorAccessPort;
  const held = [...(input.held ?? [true])];
  const sandboxes = {
    open: vi.fn(async () => ({ id: 'sandbox_1', state: 'starting' as const })),
    holdForEditor: vi.fn(async () =>
      (held.shift() ?? true) ? ('starting' as const) : null,
    ),
  };
  let next = 0;
  const handler = new ConnectEditorHandler(
    access,
    sandboxes as unknown as EditorSandboxesPort,
    { generate: () => `conn_${++next}` },
    { now: () => NOW, sleep: async () => {} },
  );

  return {
    access,
    sandboxes,
    connect: (viewer: string, slug: string | null = null) =>
      handler.execute(
        new ConnectEditorCommand(viewer, { kind: 'task', id: 'task_1' }, slug),
      ),
  };
};

describe('ConnectEditorHandler', () => {
  it('opens the sandbox of the workspace Work names for the person, and holds it with an editor lease', async () => {
    const { connect, access, sandboxes } = setUp();

    expect(await connect('user_bea', 'acme')).toEqual({
      sandboxId: 'sandbox_1',
      holder: 'conn_1',
    });
    expect(access.editorAccessFor).toHaveBeenCalledWith(
      'user_bea',
      { kind: 'task', id: 'task_1' },
      'acme',
    );
    expect(sandboxes.open).toHaveBeenCalledWith('ws_1', 'task-task_1', NOW);
    expect(sandboxes.holdForEditor).toHaveBeenCalledWith(
      'sandbox_1',
      'conn_1',
      NOW,
    );
  });

  it('opens nothing for a person Work refuses', async () => {
    const { connect, sandboxes } = setUp();

    expect(await connect('user_outsider')).toBeNull();
    expect(sandboxes.open).not.toHaveBeenCalled();
  });

  it('opens the next sandbox of the key when the one it found drained meanwhile', async () => {
    const { connect, sandboxes } = setUp({ held: [false, true] });

    expect(await connect('user_bea')).not.toBeNull();
    expect(sandboxes.open).toHaveBeenCalledTimes(2);
  });
});
