import { InvalidJournalEntryError } from '@runs/domain/exceptions/invalid-journal-entry.error';
import { isControlPlaneType } from '@runs/domain/value-objects/journal-entry-type';
import { JournalSeq } from '@runs/domain/value-objects/journal-seq.vo';

export class ReportedJournalEntry {
  private constructor(
    readonly seq: JournalSeq,
    readonly type: string,
    readonly at: Date,
    readonly message: string | undefined,
    readonly data: string | undefined,
  ) {}

  static of(input: {
    readonly seq: number;
    readonly type: string;
    readonly at: string;
    readonly message?: string;
    readonly data?: string;
  }): ReportedJournalEntry {
    const seq = JournalSeq.fromRunner(input.seq);

    if (isControlPlaneType(input.type)) {
      throw new InvalidJournalEntryError(
        `type ${input.type} is written only by the control plane`,
      );
    }

    const at = new Date(input.at);

    if (Number.isNaN(at.getTime())) {
      throw new InvalidJournalEntryError(`time ${input.at} is not a time`);
    }

    return new ReportedJournalEntry(
      seq,
      input.type,
      at,
      input.message,
      input.data,
    );
  }
}
