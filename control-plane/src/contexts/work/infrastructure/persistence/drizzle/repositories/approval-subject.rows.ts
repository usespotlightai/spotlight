import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import type { ApprovalSubjectRow } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';

export const toApprovalSubject = (row: ApprovalSubjectRow): ApprovalSubject =>
  row.kind === 'tool-call'
    ? ApprovalSubject.toolCall(
        ToolCall.rehydrate({ tool: row.tool, inputs: row.inputs }),
      )
    : ApprovalSubject.harnessPermission(
        HarnessPermission.rehydrate({
          harness: row.harness,
          kind: row.asks,
          title: row.title,
          input: row.input,
          tool: row.called ? CalledTool.of(row.called) : null,
        }),
      );

export const toApprovalSubjectRow = (
  subject: ApprovalSubject,
): ApprovalSubjectRow =>
  subject.when<ApprovalSubjectRow>({
    toolCall: (call) => ({ kind: 'tool-call', ...call.parts }),
    harnessPermission: (permission) => ({
      kind: 'harness-permission',
      harness: permission.harness.value,
      asks: permission.kind,
      title: permission.title,
      input: permission.input,
      called: permission.tool
        ? { server: permission.tool.server, tool: permission.tool.tool }
        : null,
    }),
  });
