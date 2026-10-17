import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import type { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';

export const APPROVAL_SUBJECT_KINDS = [
  'tool-call',
  'harness-permission',
] as const;

export type ApprovalSubjectKind = (typeof APPROVAL_SUBJECT_KINDS)[number];

type Subject =
  | { readonly kind: 'tool-call'; readonly call: ToolCall }
  | {
      readonly kind: 'harness-permission';
      readonly permission: HarnessPermission;
    };

export class ApprovalSubject {
  private constructor(private readonly subject: Subject) {}

  static toolCall(call: ToolCall): ApprovalSubject {
    return new ApprovalSubject({ kind: 'tool-call', call });
  }

  static harnessPermission(permission: HarnessPermission): ApprovalSubject {
    return new ApprovalSubject({ kind: 'harness-permission', permission });
  }

  get kind(): ApprovalSubjectKind {
    return this.subject.kind;
  }

  when<T>(cases: {
    toolCall: (call: ToolCall) => T;
    harnessPermission: (permission: HarnessPermission) => T;
  }): T {
    return this.subject.kind === 'tool-call'
      ? cases.toolCall(this.subject.call)
      : cases.harnessPermission(this.subject.permission);
  }

  get name(): string {
    return this.when({
      toolCall: (call) => call.tool.value,
      harnessPermission: (permission) => permission.name,
    });
  }

  get tool(): CalledTool {
    return this.when({
      toolCall: (call) =>
        CalledTool.of({ server: null, tool: call.tool.value }),
      harnessPermission: (permission) =>
        permission.tool ??
        CalledTool.of({ server: null, tool: permission.name }),
    });
  }

  get writtenInputs(): readonly {
    readonly name: string;
    readonly value: string;
  }[] {
    return this.when({
      toolCall: (call) => call.writtenInputs,
      harnessPermission: (permission) => permission.writtenInputs,
    });
  }

  equals(other: ApprovalSubject): boolean {
    const mine = this.subject;
    const theirs = other.subject;

    if (mine.kind === 'tool-call') {
      return theirs.kind === 'tool-call' && mine.call.equals(theirs.call);
    }

    return (
      theirs.kind === 'harness-permission' &&
      mine.permission.equals(theirs.permission)
    );
  }
}
