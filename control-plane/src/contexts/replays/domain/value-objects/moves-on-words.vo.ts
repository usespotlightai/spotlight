export class MovesOnWords {
  private constructor(readonly words: readonly string[]) {}

  static of(words: readonly string[]): MovesOnWords {
    return new MovesOnWords(words.map((word) => word.toLowerCase()));
  }

  includes(next: string): boolean {
    return this.words.includes(next.toLowerCase());
  }

  equals(other: MovesOnWords): boolean {
    return (
      this.words.length === other.words.length &&
      this.words.every((word, at) => word === other.words[at])
    );
  }
}
