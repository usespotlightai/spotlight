export class SecretUses {
  private readonly kind = 'secret-uses';

  private constructor(readonly by: readonly string[]) {}

  static of(by: readonly string[]): SecretUses {
    return new SecretUses([...by].sort());
  }

  static none(): SecretUses {
    return new SecretUses([]);
  }

  get isEmpty(): boolean {
    return this.by.length === 0;
  }

  equals(other: SecretUses): boolean {
    return (
      this.kind === other.kind &&
      this.by.length === other.by.length &&
      this.by.every((each, at) => each === other.by[at])
    );
  }
}
