import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';

export const CITATION_KINDS = ['step', 'hunk'] as const;

export type CitationKind = (typeof CITATION_KINDS)[number];

export class Citation {
  private constructor(
    readonly kind: CitationKind,
    readonly step: number | null,
    readonly hunk: string | null,
  ) {}

  static ofStep(index: number): Citation {
    if (!Number.isInteger(index) || index < 0) {
      throw new InvalidScoreError(
        'cites a step of its run by its place in the journal',
        'reason',
      );
    }

    return new Citation('step', index, null);
  }

  static ofHunk(id: string): Citation {
    if (!id.trim()) {
      throw new InvalidScoreError(
        'cites a hunk of its run’s changes by its id',
        'reason',
      );
    }

    return new Citation('hunk', null, id.trim());
  }

  equals(other: Citation): boolean {
    return (
      this.kind === other.kind &&
      this.step === other.step &&
      this.hunk === other.hunk
    );
  }
}
