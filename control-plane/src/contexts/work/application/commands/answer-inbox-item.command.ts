import type {
  ApprovalDecision,
  ApprovalEdits,
} from '@work/domain/value-objects/approval.vo';

export class AnswerInboxItemCommand {
  constructor(
    readonly itemId: string,
    readonly answeredBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
    readonly decision: ApprovalDecision | null = null,
    readonly edits: ApprovalEdits | null = null,
  ) {}
}
