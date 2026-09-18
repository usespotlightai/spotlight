export class SealedVault {
  private constructor(readonly text: string) {}

  static of(text: string): SealedVault {
    return new SealedVault(text);
  }

  equals(other: SealedVault): boolean {
    return this.text === other.text;
  }
}
