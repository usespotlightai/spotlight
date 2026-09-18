import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ContinuityKey {
  private constructor(readonly value: string) {}

  static of(raw: string): ContinuityKey {
    const key = raw.trim();

    if (key.length === 0) {
      throw new InvalidIdentifierError('continuity key');
    }

    return new ContinuityKey(key);
  }

  static for({
    taskId,
    stationId,
  }: {
    taskId: string;
    stationId: string;
  }): ContinuityKey {
    return ContinuityKey.of(`${taskId}-${stationId}`);
  }

  static forChat(chatId: string): ContinuityKey {
    return ContinuityKey.of(`chat-${chatId}`);
  }

  equals(other: ContinuityKey): boolean {
    return this.value === other.value;
  }
}
