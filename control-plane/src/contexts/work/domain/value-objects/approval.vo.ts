import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import type { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export const APPROVAL_STATUSES = ['asked', 'granted', 'refused'] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type ApprovalDecision = Exclude<ApprovalStatus, 'asked'>;

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
    readonly status: ApprovalStatus,
    readonly decided: Decided | null,
    readonly spent: boolean,
    readonly edited: ToolCall | null,
    readonly intent: ApprovalIntent | null,
    readonly askedOf: UserId | null,
  ) {}

  static asked(
    subject: ApprovalSubject,
    at: StationId,
    because: string,
    intent: ApprovalIntent | null,
    askedOf: UserId | null = null,
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
      askedOf,
    );
  }

  static rehydrate(input: {
    subject: ApprovalSubject;
    at: StationId;
    because: string;
    status: ApprovalStatus;
    decided: Decided | null;
    spent: boolean;
    edited: ToolCall | null;
    intent: ApprovalIntent | null;
    askedOf: UserId | null;
  }): Approval {
    return new Approval(
      input.subject,
      input.at,
      input.because,
      input.status,
      input.decided,
      input.spent,
      input.edited,
      input.intent,
      input.askedOf,
    );
  }

  get open(): boolean {
    return this.status === 'asked';
  }

  get grants(): boolean {
    return this.status === 'granted' && !this.spent;
  }

  grantedFor(askedOf: UserId | null): boolean {
    return (
      this.grants &&
      (askedOf === null || (this.decided?.by.equals(askedOf) ?? false))
    );
  }

  get refuses(): boolean {
    return this.status === 'refused';
  }

  get goesAheadWith(): ToolInputs | null {
    return this.edited?.inputs ?? null;
  }

  appliesTo(subject: ApprovalSubject, at: StationId): boolean {
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
        `Approval request was already ${this.status === 'granted' ? 'approved' : 'dismissed'}.`,
      );
    }

    if (
      decision === 'granted' &&
      this.askedOf &&
      !this.askedOf.equals(decided.by)
    ) {
      throw new InvalidApprovalAnswerError(
        'Only the person whose connection the tool acts with can approve this request.',
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
      this.askedOf,
    );
  }

  private grantedWith(
    decision: ApprovalDecision,
    edits: ApprovalEdits,
  ): ToolCall | null {
    if (decision !== 'granted') {
      throw new InvalidApprovalAnswerError(
        'A dismissed request cannot run with changes.',
      );
    }

    return this.changedBy(edits);
  }

  changedBy(edits: ApprovalEdits): ToolCall | null {
    const asked = this.subject.when({
      toolCall: (call) => call,
      harnessPermission: () => {
        throw new InvalidApprovalAnswerError(
          'A harness permission takes only yes or no. Its request cannot be edited.',
        );
      },
    });
    const edited = asked.editedTo(edits);

    if (!('call' in edited)) {
      throw new InvalidApprovalAnswerError(
        edited.problem
          ? `The edited request cannot run. Problem: ${edited.problem}`
          : `Edits must fill every input of the call with a value of its kind. Inputs of the call: ${asked.writtenInputs.map((each) => each.name).join(', ') || 'none'}`,
      );
    }

    return edited.call.equals(asked) ? null : edited.call;
  }

  claimed(): Approval {
    if (!this.grants) {
      throw new InvalidApprovalAnswerError(
        'Approval grants nothing. The tool cannot run.',
      );
    }

    return this.withSpent(true);
  }

  returned(): Approval {
    return this.status === 'granted' && this.spent
      ? this.withSpent(false)
      : this;
  }

  private withSpent(spent: boolean): Approval {
    return new Approval(
      this.subject,
      this.at,
      this.because,
      this.status,
      this.decided,
      spent,
      this.edited,
      this.intent,
      this.askedOf,
    );
  }
}
