import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';

export const MAX_DISAGREEMENT_NOTE_CHARS = 2_000;

export const noteOf = (raw: string | null): string | null => {
  const note = raw?.trim() ?? '';

  if (note.length > MAX_DISAGREEMENT_NOTE_CHARS) {
    throw new InvalidJudgeDisagreementError(
      `note must be at most ${MAX_DISAGREEMENT_NOTE_CHARS} characters`,
    );
  }

  return note || null;
};

export const isClaimPlace = (value: number): boolean =>
  Number.isInteger(value) && value >= 0;
