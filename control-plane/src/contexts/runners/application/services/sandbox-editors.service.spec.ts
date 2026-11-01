import type { EditorSandboxesPort } from '@runners/application/ports/editor-sandboxes.port';
import type { SandboxTunnelsPort } from '@runners/application/ports/sandbox-tunnels.port';
import { SandboxEditors } from '@runners/application/services/sandbox-editors.service';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T10:00:00.000Z');

const setUp = (input: { held?: boolean[] } = {}) => {
  const held = [...(input.held ?? [true])];
  const sandboxes = {
    open: vi.fn(async () => ({ id: 'sandbox_1', state: 'starting' as const })),
    holdForEditor: vi.fn(async () =>
      (held.shift() ?? true) ? ('starting' as const) : null,
    ),
  };
  let next = 0;
  const editors = new SandboxEditors(
    sandboxes as unknown as EditorSandboxesPort,
    {} as SandboxTunnelsPort,
    { generate: () => `conn_${++next}` },
    { now: () => NOW, sleep: async () => {} },
  );

  return { editors, sandboxes };
};

describe('SandboxEditors', () => {
  it('opens the sandbox of the workspace and key, and holds it with an editor lease', async () => {
    const { editors, sandboxes } = setUp();

    expect(await editors.hold('ws_1', 'task-task_1')).toEqual({
      sandboxId: 'sandbox_1',
      holder: 'conn_1',
    });
    expect(sandboxes.open).toHaveBeenCalledWith('ws_1', 'task-task_1', NOW);
    expect(sandboxes.holdForEditor).toHaveBeenCalledWith(
      'sandbox_1',
      'conn_1',
      NOW,
    );
  });

  it('opens the next sandbox of the key when the one it found drained meanwhile', async () => {
    const { editors, sandboxes } = setUp({ held: [false, true] });

    expect(await editors.hold('ws_1', 'task-task_1')).not.toBeNull();
    expect(sandboxes.open).toHaveBeenCalledTimes(2);
  });

  it('fails when the sandbox drains on each attempt', async () => {
    const { editors } = setUp({ held: [false, false, false] });

    await expect(editors.hold('ws_1', 'task-task_1')).rejects.toThrow(
      'The sandbox of task-task_1 drained each time an editor tried to hold it',
    );
  });
});
