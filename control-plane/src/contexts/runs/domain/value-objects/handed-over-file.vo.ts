export class HandedOverFile {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly contentType: string,
    readonly size: number,
  ) {}

  static of(input: {
    id: string;
    name: string;
    contentType: string;
    size: number;
  }): HandedOverFile {
    return new HandedOverFile(
      input.id,
      input.name,
      input.contentType,
      input.size,
    );
  }

  equals(other: HandedOverFile): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.contentType === other.contentType &&
      this.size === other.size
    );
  }
}
