import { Remark } from '@domain/value-objects/remark.vo';

/** What was said about a task, and where in the code it was said about. */
export class Said {
  private constructor(
    readonly body: string,
    readonly path: string | null,
    readonly from: number | null,
    readonly to: number | null,
    // Absent where the host named nothing to answer, as a merge names nothing.
    readonly remark: Remark | null,
  ) {}

  static of(input: {
    body?: string | null;
    path?: string | null;
    from?: number | null;
    to?: number | null;
    remark?: string | null;
  }): Said | null {
    const body = input.body?.trim() ?? '';
    const path = input.path?.trim() || null;

    return body || path
      ? new Said(
          body,
          path,
          input.from ?? null,
          input.to ?? null,
          input.remark ? Remark.of(input.remark) : null,
        )
      : null;
  }

  /** Kept whole on a note, so nothing has to read it back out of prose. */
  get parts(): {
    body: string;
    path: string | null;
    from: number | null;
    to: number | null;
    remark: string | null;
  } {
    return {
      body: this.body,
      path: this.path,
      from: this.from,
      to: this.to,
      remark: this.remark?.value ?? null,
    };
  }

  /** Where it was said about, if anywhere: a file, and the line in it. */
  get place(): string | null {
    if (!this.path) {
      return null;
    }

    const lines =
      this.from && this.to && this.to !== this.from
        ? `:${this.from}-${this.to}`
        : this.from
          ? `:${this.from}`
          : '';

    return `${this.path}${lines}`;
  }
}
