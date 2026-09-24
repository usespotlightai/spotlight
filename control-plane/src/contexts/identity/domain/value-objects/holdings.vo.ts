export class Holdings {
  private readonly kind = 'holdings';

  private constructor(readonly held: readonly string[]) {}

  static of(held: readonly string[]): Holdings {
    return new Holdings([...held].sort());
  }

  static none(): Holdings {
    return new Holdings([]);
  }

  and(other: Holdings): Holdings {
    return Holdings.of([...this.held, ...other.held]);
  }

  get isEmpty(): boolean {
    return this.held.length === 0;
  }

  equals(other: Holdings): boolean {
    return (
      this.kind === other.kind &&
      this.held.length === other.held.length &&
      this.held.every((each, at) => each === other.held[at])
    );
  }
}
