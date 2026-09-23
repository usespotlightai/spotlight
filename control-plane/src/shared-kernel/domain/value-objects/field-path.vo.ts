export type FieldSegment = string | number;

const INDEX = /^\d+$/;

export class FieldPath {
  private constructor(readonly segments: readonly FieldSegment[]) {}

  static root(): FieldPath {
    return new FieldPath([]);
  }

  static of(segments: readonly PropertyKey[]): FieldPath {
    return new FieldPath(
      segments.map((each) => (typeof each === 'number' ? each : String(each))),
    );
  }

  static dotted(held: string): FieldPath {
    const text = held.trim();

    return new FieldPath(
      text === ''
        ? []
        : text
            .split('.')
            .map((each) => (INDEX.test(each) ? Number(each) : each)),
    );
  }

  get isRoot(): boolean {
    return this.segments.length === 0;
  }

  equals(other: FieldPath): boolean {
    return (
      this.segments.length === other.segments.length &&
      this.segments.every((each, at) => each === other.segments[at])
    );
  }
}
