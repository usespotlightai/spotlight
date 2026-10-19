import { InvalidReleaseError } from '@shared-kernel/domain/exceptions/invalid-release.error';

const PART = '(0|[1-9]\\d*)';

const SHAPE = new RegExp(`^v${PART}\\.${PART}\\.${PART}(?:-rc\\.${PART})?$`);

const FINAL = Number.MAX_SAFE_INTEGER;

const orderOf = (raw: string): number[] | null => {
  const parts = SHAPE.exec(raw);

  if (!parts) {
    return null;
  }

  const [, major, minor, patch, candidate] = parts;
  return [
    Number(major),
    Number(minor),
    Number(patch),
    candidate === undefined ? FINAL : Number(candidate),
  ];
};

export class Release {
  private constructor(readonly value: string) {}

  static of(raw: string): Release {
    if (!orderOf(raw)) {
      throw new InvalidReleaseError(
        `${raw} must be a published release, as in v1.2.3 or v1.2.3-rc.1`,
      );
    }

    return new Release(raw);
  }

  static published(raw: string | null): Release | null {
    return raw !== null && orderOf(raw) ? new Release(raw) : null;
  }

  isOlderThan(other: Release): boolean {
    const have = orderOf(this.value) ?? [];
    const need = orderOf(other.value) ?? [];
    const differs = have.findIndex((part, at) => part !== need[at]);
    return differs !== -1 && have[differs] < need[differs];
  }
}
