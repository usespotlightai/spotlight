import { AcpHarnessToolNames } from '@work/infrastructure/acp/harness-tools';
import { describe, expect, it } from 'vitest';

describe('AcpHarnessToolNames', () => {
  const names = new AcpHarnessToolNames();

  it('names the server and tool a permission asks for', () => {
    expect(names.toolFor('mcp__linear__create_issue', 'other')).toEqual({
      server: 'linear',
      tool: 'create_issue',
    });
  });

  it('never reads a server out of a command a permission asks to run', () => {
    expect(names.toolFor('mcp__linear__create_issue', 'execute')).toBeNull();
  });
});
