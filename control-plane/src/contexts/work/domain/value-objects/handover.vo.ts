import {
  HANDOVER_TO_A_PERSON,
  HANDOVER_TO_FINISH,
  requestsAPerson,
} from '@shared-kernel/domain/value-objects/handover-word';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

export const MAX_HANDOVER_ATTACHMENTS = 10;

export class Handover {
  private constructor(
    readonly next: string,
    readonly note: string,
    readonly attachments: readonly Attachment[],
  ) {}

  static of(input: {
    next?: string;
    note?: string;
    attachments?: readonly Attachment[];
  }): Handover {
    const attachments = input.attachments ?? [];

    if (attachments.length > MAX_HANDOVER_ATTACHMENTS) {
      throw new InvalidAttachmentError(
        `must be at most ${MAX_HANDOVER_ATTACHMENTS} files for one handover`,
      );
    }

    return new Handover(
      (input.next ?? '').trim(),
      (input.note ?? '').trim(),
      attachments,
    );
  }

  sentToReview(reason: string): Handover {
    return new Handover(
      HANDOVER_TO_A_PERSON,
      [reason.trim(), this.note === '' ? '' : `Note from the run: ${this.note}`]
        .filter(Boolean)
        .join('\n\n'),
      this.attachments,
    );
  }

  isDone(): boolean {
    return this.next.toLowerCase() === HANDOVER_TO_FINISH;
  }

  requestsReview(): boolean {
    return requestsAPerson(this.next);
  }

  names(key: StationKey): boolean {
    return key.value.toLowerCase() === this.next.toLowerCase();
  }

  equals(other: Handover): boolean {
    return (
      this.next === other.next &&
      this.note === other.note &&
      this.attachments.length === other.attachments.length &&
      this.attachments.every((each, at) =>
        each.equals(other.attachments[at] as Attachment),
      )
    );
  }
}
