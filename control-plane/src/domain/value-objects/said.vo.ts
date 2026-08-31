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

  /** The place first, so a station reads where before it reads what. */
  get value(): string {
    return [this.at, this.body].filter(Boolean).join('\n\n');
  }

  private get at(): string {
    if (!this.path) {
      return '';
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
