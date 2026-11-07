import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const LONGEST = 200;

export class ApprovalIntent {
  private constructor(readonly value: string) {}

  static from(text: unknown): ApprovalIntent | null {
    if (typeof text !== 'string') {
      return null;
    }

    const line = text.replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
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
    const length = Array.from(value).length;

    if (length === 0 || length > LONGEST || value.trim() !== value) {
      throw new InconsistentStateError(
        'approval intent',
        'is empty, padded or longer than one short line',
      );
    }

    return new ApprovalIntent(value);
  }

  equals(other: ApprovalIntent): boolean {
    return this.value === other.value;
  }
}
