import { Remark } from '@work/domain/value-objects/remark.vo';

export class Said {
  private constructor(
    readonly body: string,
    readonly path: string | null,
    readonly from: number | null,
    readonly to: number | null,
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

  equals(other: Said): boolean {
    return (
      this.body === other.body &&
      this.path === other.path &&
      this.from === other.from &&
      this.to === other.to &&
      (this.remark === null
        ? other.remark === null
        : other.remark !== null && this.remark.equals(other.remark))
    );
  }

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
