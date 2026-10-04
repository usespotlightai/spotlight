const LONGEST = 200;

export class ApprovalIntent {
  private constructor(readonly value: string) {}

  static said(said: unknown): ApprovalIntent | null {
    if (typeof said !== 'string') {
      return null;
    }

    const line = said.replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
    const characters = Array.from(line);

    if (characters.length === 0) {
      return null;
    }

    return new ApprovalIntent(
      characters.length > LONGEST
        ? `${characters
            .slice(0, LONGEST - 1)
            .join('')
            .trimEnd()}…`
        : line,
    );
  }

  static rehydrate(value: string): ApprovalIntent {
    return new ApprovalIntent(value);
  }
}
