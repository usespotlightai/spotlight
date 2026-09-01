/** What was said about a task, and where in the code it was said about. */
export class Said {
  private constructor(
    readonly body: string,
    readonly path: string | null,
    readonly from: number | null,
    readonly to: number | null,
  ) {}

  static of(input: {
    body?: string | null;
    path?: string | null;
    from?: number | null;
    to?: number | null;
  }): Said | null {
    const body = input.body?.trim() ?? '';
    const path = input.path?.trim() || null;

    return body || path
      ? new Said(body, path, input.from ?? null, input.to ?? null)
      : null;
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
