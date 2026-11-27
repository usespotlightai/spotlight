import { nonEmpty } from '@shared-kernel/domain/non-empty';
export class Pusher {
  private constructor(readonly value: string) {}

  static of(login: string | null): Pusher | null {
    const trimmed = login?.trim();

    return nonEmpty(trimmed) ? new Pusher(trimmed) : null;
  }

  equals(other: Pusher): boolean {
    return this.value === other.value;
  }
}
