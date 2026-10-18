export class Dependents {
  private readonly kind = 'dependents';

  private constructor(readonly names: readonly string[]) {}

  static of(names: readonly string[]): Dependents {
    return new Dependents([...names].sort());
  }

  static none(): Dependents {
    return new Dependents([]);
  }

  and(other: Dependents): Dependents {
    return Dependents.of([...this.names, ...other.names]);
  }

  get isEmpty(): boolean {
    return this.names.length === 0;
  }

  equals(other: Dependents): boolean {
    return (
      this.kind === other.kind &&
      this.names.length === other.names.length &&
      this.names.every((each, at) => each === other.names[at])
    );
  }
}
