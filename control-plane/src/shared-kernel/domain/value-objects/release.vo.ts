import { InvalidReleaseError } from '@shared-kernel/domain/exceptions/invalid-release.error';

const PART = '(0|[1-9]\\d*)';

const SHAPE = new RegExp(`^v${PART}\\.${PART}\\.${PART}(?:-rc\\.${PART})?$`);

const FINAL = Number.POSITIVE_INFINITY;

export class Release {
  private constructor(
    readonly value: string,
    private readonly order: readonly number[],
  ) {}

  static of(raw: string): Release {
    const parts = SHAPE.exec(raw);

    if (!parts) {
      throw new InvalidReleaseError(
        `${raw} must be a published release, as in v1.2.3 or v1.2.3-rc.1`,
      );
    }

    const [, major, minor, patch, candidate] = parts;
    return new Release(raw, [
      Number(major),
      Number(minor),
      Number(patch),
      candidate === undefined ? FINAL : Number(candidate),
    ]);
  }

  static published(raw: string | null): Release | null {
    try {
      return raw === null ? null : Release.of(raw);
    } catch {
      return null;
    }
  }

  isOlderThan(other: Release): boolean {
    const differs = this.order.findIndex(
      (part, at) => part !== other.order[at],
    );
    return differs !== -1 && this.order[differs] < other.order[differs];
  }
}
