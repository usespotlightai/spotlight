export type FieldSegment = string | number;

const INDEX = /^\d+$/;

export const ANY_SEGMENT = '*';

const NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

const FIRST = /^[A-Za-z_][A-Za-z0-9_-]*/;

const NEXT =
  /^(?:\.([A-Za-z_][A-Za-z0-9_-]*)|\[(\d+)\]|\[(\*)\]|\[("(?:[^"\\]|\\.)*")\])/;

const renderedSegment = (segment: FieldSegment, first: boolean): string => {
  if (typeof segment === 'number') {
    return `[${segment}]`;
  }

  if (segment === ANY_SEGMENT) {
    return `[${ANY_SEGMENT}]`;
  }

  if (NAME.test(segment)) {
    return first ? segment : `.${segment}`;
  }

  return `[${JSON.stringify(segment)}]`;
};

const parsedSegment = ([, name, index, any, quoted]: RegExpExecArray):
  | FieldSegment
  | undefined =>
  name ??
  (index !== undefined
    ? Number(index)
    : (any ??
      (quoted !== undefined ? (JSON.parse(quoted) as string) : undefined)));

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

  static dotted(input: string): FieldPath {
    const text = input.trim();

    return new FieldPath(
      text === ''
        ? []
        : text
            .split('.')
            .map((each) => (INDEX.test(each) ? Number(each) : each)),
    );
  }

  to(...segments: readonly FieldSegment[]): FieldPath {
    return new FieldPath([...this.segments, ...segments]);
  }

  static parsed(written: string): FieldPath | null {
    const first = FIRST.exec(written)?.[0];

    if (!first) {
      return null;
    }

    const segments: FieldSegment[] = [first];
    let rest = written.slice(first.length);

    while (rest.length > 0) {
      const found = NEXT.exec(rest);
      const segment = found ? parsedSegment(found) : undefined;

      if (!found || segment === undefined) {
        return null;
      }

      segments.push(segment);
      rest = rest.slice(found[0].length);
    }

    return new FieldPath(segments);
  }

  get rendered(): string {
    return this.segments
      .map((each, at) => renderedSegment(each, at === 0))
      .join('');
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
