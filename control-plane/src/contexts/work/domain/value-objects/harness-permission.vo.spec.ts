import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { describe, expect, it } from 'vitest';

const asked = (input: unknown, kind = 'execute') =>
  HarnessPermission.asked({
    harness: HarnessId.of('claude-code'),
    kind,
    title: '`rm -rf build`',
    input,
    tool: null,
  });

describe('a permission a harness asks for', () => {
  it('is named for the harness and the kind of action it asks about', () => {
    const permission = asked({ command: 'rm -rf build' });

    expect(permission.name).toBe('claude-code execute');
    expect(permission.writtenInputs).toEqual([
      { name: 'title', value: '`rm -rf build`' },
      { name: 'input', value: '{"command":"rm -rf build"}' },
    ]);
  });

  it('is the same permission when asked again with other words about it', () => {
    expect(
      asked({
        description: 'Clear the build',
        command: 'rm -rf build',
      }).equals(
        asked({ command: 'rm -rf build', description: 'Remove output' }),
      ),
    ).toBe(true);
  });

  it('is another permission when what it would do differs', () => {
    expect(
      asked({ command: 'rm -rf build' }).equals(
        asked({ command: 'rm -rf dist' }),
      ),
    ).toBe(false);
  });

  it('names a kind the harness left out, or wrote its own way, as a word', () => {
    expect(asked({}, '').kind).toBe('other');
    expect(asked({}, 'switch_mode').kind).toBe('switch-mode');
  });

  it('reads back as it was asked', () => {
    const permission = asked({ command: 'rm -rf build' });

    expect(
      HarnessPermission.rehydrate({
        harness: 'claude-code',
        kind: permission.kind,
        title: permission.title,
        input: permission.input,
        tool: permission.tool,
      }).equals(permission),
    ).toBe(true);
  });
});
