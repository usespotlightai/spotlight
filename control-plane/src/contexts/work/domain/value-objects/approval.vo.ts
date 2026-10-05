import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import type { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export const APPROVAL_STANDINGS = ['asked', 'granted', 'refused'] as const;

export type ApprovalStanding = (typeof APPROVAL_STANDINGS)[number];

export type ApprovalDecision = Exclude<ApprovalStanding, 'asked'>;

export type ApprovalEdits = Readonly<Record<string, string>>;

export interface Decided {
  readonly by: UserId;
  readonly at: Date;
  readonly reason: string;
}

export class Approval {
  private constructor(
    readonly subject: ApprovalSubject,
    readonly at: StationId,
    readonly because: string,
    readonly standing: ApprovalStanding,
    readonly decided: Decided | null,
    readonly spent: boolean,
    readonly edited: ToolCall | null,
    readonly intent: ApprovalIntent | null,
  ) {}

  static asked(
    subject: ApprovalSubject,
    at: StationId,
    because: string,
    intent: ApprovalIntent | null,
  ): Approval {
    return new Approval(
      subject,
      at,
      because,
      'asked',
      null,
      false,
      null,
      intent,
    );
  }

  static rehydrate(input: {
    subject: ApprovalSubject;
    at: StationId;
    because: string;
    standing: ApprovalStanding;
    decided: Decided | null;
    spent: boolean;
    edited: ToolCall | null;
    intent: ApprovalIntent | null;
  }): Approval {
    return new Approval(
      input.subject,
      input.at,
      input.because,
      input.standing,
      input.decided,
      input.spent,
      input.edited,
      input.intent,
    );
  }

  get open(): boolean {
    return this.standing === 'asked';
  }

  get grants(): boolean {
    return this.standing === 'granted' && !this.spent;
  }

  get refuses(): boolean {
    return this.standing === 'refused';
  }

  get goesAheadWith(): ToolInputs | null {
    return this.edited?.inputs ?? null;
  }

  standsFor(subject: ApprovalSubject, at: StationId): boolean {
    return (
      this.at.equals(at) &&
      (this.subject.equals(subject) ||
        (this.edited !== null &&
          ApprovalSubject.toolCall(this.edited).equals(subject)))
    );
  }

  decide(
    decision: ApprovalDecision,
    decided: Decided,
    edits: ApprovalEdits | null = null,
  ): Approval {
    if (!this.open) {
      throw new InvalidApprovalAnswerError(
        `was already ${this.standing === 'granted' ? 'approved' : 'dismissed'}, so it cannot be decided again`,
      );
    }

    return new Approval(
      this.subject,
      this.at,
      this.because,
      decision,
      decided,
      false,
      edits ? this.grantedWith(decision, edits) : null,
      this.intent,
    );
  }

  private grantedWith(
    decision: ApprovalDecision,
    edits: ApprovalEdits,
  ): ToolCall | null {
    if (decision !== 'granted') {
      throw new InvalidApprovalAnswerError(
        'is being dismissed, so there is nothing to run with changes',
      );
    }

    return this.changedBy(edits);
  }

  changedBy(edits: ApprovalEdits): ToolCall | null {
    const asked = this.subject.when({
      toolCall: (call) => call,
      harnessPermission: () => {
        throw new InvalidApprovalAnswerError(
          'waits on a harness, which only takes a yes or a no, so what it does cannot be changed',
        );
      },
    });
    const edited = asked.editedTo(edits);

    if (!('call' in edited)) {
      throw new InvalidApprovalAnswerError(
        edited.refused
          ? `asks about a tool that cannot run with that change: ${edited.refused}`
          : `asks about ${asked.given.map((each) => each.name).join(', ') || 'no inputs'}, so changes must name exactly those, each a value of the kind asked and none left blank`,
      );
    }

    return edited.call.equals(asked) ? null : edited.call;
  }

  claimed(): Approval {
    if (!this.grants) {
      throw new InvalidApprovalAnswerError(
        'grants nothing to use, so the tool cannot run on it',
      );
    }

    return this.withSpent(true);
  }

  returned(): Approval {
    return this.standing === 'granted' && this.spent
      ? this.withSpent(false)
      : this;
  }

  private withSpent(spent: boolean): Approval {
    return new Approval(
      this.subject,
      this.at,
      this.because,
      this.standing,
      this.decided,
      spent,
      this.edited,
      this.intent,
    );
  }
}
