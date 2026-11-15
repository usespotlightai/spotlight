import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import { ToolEnablement } from '@work/domain/services/tool-enablement';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { describe, expect, it } from 'vitest';

const READS = DeclaredTool.of({
  tool: Tool.of('sentry.get-latest-event'),
  description: 'Read the latest event of a Sentry issue.',
  readOnly: true,
});

const WRITES = DeclaredTool.of({
  tool: Tool.of('linear.comment'),
  description: 'Comment on the Linear issue.',
  readOnly: false,
});

const keepingToItself = {
  actsBeyondItself: false,
  manifest: [READS.tool.value, WRITES.tool.value],
};

describe('ToolEnablement', () => {
  it('enables only the tools in the run’s manifest', () => {
    expect(() =>
      ToolEnablement.assertEnabled(READS.tool, {
        actsBeyondItself: true,
        manifest: [],
      }),
    ).toThrow(ToolNotEnabledError);
    expect(() =>
      ToolEnablement.assertEnabled(READS.tool, keepingToItself),
    ).not.toThrow();
  });

  it('lets a run that keeps to itself call a tool that changes nothing', () => {
    expect(() =>
      ToolEnablement.assertCallable(READS, keepingToItself),
    ).not.toThrow();
  });

  it('refuses a run that keeps to itself a tool that can change data or needs approval', () => {
    expect(() =>
      ToolEnablement.assertCallable(WRITES, keepingToItself),
    ).toThrow(NotAllowedForIsolatedRunError);
    expect(() =>
      ToolEnablement.assertCallable(
        READS.withApproval(
          ApprovalNeeded.of(READS.tool.value, 'It reads private data.'),
        ),
        keepingToItself,
      ),
    ).toThrow(NotAllowedForIsolatedRunError);
  });

  it('lets a run that acts beyond itself call any tool it has', () => {
    expect(() =>
      ToolEnablement.assertCallable(WRITES, {
        ...keepingToItself,
        actsBeyondItself: true,
      }),
    ).not.toThrow();
  });
});
