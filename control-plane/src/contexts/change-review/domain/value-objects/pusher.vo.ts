export class Pusher {
  private constructor(readonly value: string) {}

  static of(login: string | null): Pusher | null {
    const trimmed = login?.trim();

    return trimmed ? new Pusher(trimmed) : null;
  }

  equals(other: Pusher): boolean {
    return this.value === other.value;
  }
}
