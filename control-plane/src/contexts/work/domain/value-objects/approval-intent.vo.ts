export const INTENT_INPUT = 'intent';

const LONGEST = 200;

export class ApprovalIntent {
  private constructor(readonly value: string) {}

  static said(said: unknown): ApprovalIntent | null {
    if (typeof said !== 'string') {
      return null;
    }

    const line = said
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!]+$/, '');

    if (!line) {
      return null;
    }

    return new ApprovalIntent(
      line.length > LONGEST ? `${line.slice(0, LONGEST - 1)}…` : line,
    );
  }

  static rehydrate(value: string): ApprovalIntent {
    return new ApprovalIntent(value);
  }
}
