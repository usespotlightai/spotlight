import { InvalidHandoverError } from '@runs/domain/exceptions/invalid-handover.error';
import type { HandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';

export const MAX_HANDOVER_ATTACHMENTS = 10;

export class Handover {
  private constructor(
    readonly next: string,
    readonly note: string,
    readonly attachments: readonly HandedOverFile[],
  ) {}

  static of(input: {
    next?: string;
    note?: string;
    attachments?: readonly HandedOverFile[];
  }): Handover {
    const attachments = input.attachments ?? [];

    if (attachments.length > MAX_HANDOVER_ATTACHMENTS) {
      throw new InvalidHandoverError(
        `must carry at most ${MAX_HANDOVER_ATTACHMENTS} files`,
      );
    }

    return new Handover(
      (input.next ?? '').trim(),
      (input.note ?? '').trim(),
      attachments,
    );
  }

  equals(other: Handover): boolean {
    return (
      this.next === other.next &&
      this.note === other.note &&
      this.attachments.length === other.attachments.length &&
      this.attachments.every((each, at) =>
        each.equals(other.attachments[at] as HandedOverFile),
      )
    );
  }
}
