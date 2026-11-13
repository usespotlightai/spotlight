import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { HeldHarnessKeys } from '@runs/application/services/held-harness-keys.service';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const launch = {
  catalogue: () => [
    {
      id: 'claude-code',
      harnessKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
    },
    { id: 'codex', harnessKeys: ['CODEX_API_KEY', 'OPENAI_API_KEY'] },
    { id: 'opencode', harnessKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] },
  ],
} as unknown as HarnessLaunchPort;

const held = (names: readonly string[]) => {
  const namesIn = vi.fn(async () => names);

  return { namesIn, subject: new HeldHarnessKeys(launch, { namesIn }) };
};

describe('HeldHarnessKeys', () => {
  it('names the keys of one harness that the workspace holds as secrets', async () => {
    const { subject, namesIn } = held([
      'ANTHROPIC_API_KEY',
      'LINEAR_API_KEY',
      'OPENAI_API_KEY',
    ]);

    expect(
      (await subject.of(WORKSPACE, HarnessId.of('claude-code'))).map(
        (each) => each.value,
      ),
    ).toEqual(['ANTHROPIC_API_KEY']);
    expect(namesIn).toHaveBeenCalledWith('ws_1');
  });

  it('names the keys of every harness that the workspace holds, once and sorted', async () => {
    const { subject } = held([
      'OPENAI_API_KEY',
      'LINEAR_API_KEY',
      'ANTHROPIC_API_KEY',
    ]);

    expect(
      (await subject.inWorkspace(WORKSPACE)).map((each) => each.value),
    ).toEqual(['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']);
  });

  it('reads no secrets for a harness it does not know', async () => {
    const { subject, namesIn } = held(['ANTHROPIC_API_KEY']);

    expect(await subject.of(WORKSPACE, HarnessId.of('aider'))).toEqual([]);
    expect(namesIn).not.toHaveBeenCalled();
  });
});
