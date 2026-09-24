import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import type { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export const APPROVAL_STANDINGS = ['asked', 'granted', 'refused'] as const;

export type ApprovalStanding = (typeof APPROVAL_STANDINGS)[number];

export type ApprovalDecision = Exclude<ApprovalStanding, 'asked'>;

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
  ) {}

  static asked(
    subject: ApprovalSubject,
    at: StationId,
    because: string,
  ): Approval {
    return new Approval(subject, at, because, 'asked', null, false);
  }

  static rehydrate(input: {
    subject: ApprovalSubject;
    at: StationId;
    because: string;
    standing: ApprovalStanding;
    decided: Decided | null;
    spent: boolean;
  }): Approval {
    return new Approval(
      input.subject,
      input.at,
      input.because,
      input.standing,
      input.decided,
      input.spent,
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

  standsFor(subject: ApprovalSubject, at: StationId): boolean {
    return this.subject.equals(subject) && this.at.equals(at);
  }

  decide(decision: ApprovalDecision, decided: Decided): Approval {
    if (!this.open) {
      throw new InvalidApprovalAnswerError(
        `was already ${this.standing === 'granted' ? 'approved' : 'rejected'}, so it cannot be decided again`,
      );
    }

    return new Approval(
      this.subject,
      this.at,
      this.because,
      decision,
      decided,
      false,
    );
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
    );
  }
}
