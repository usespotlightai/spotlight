import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { InvalidRunnerImageError } from '@shared-kernel/domain/exceptions/invalid-runner-image.error';
import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';

const clipped = (raw: string | undefined, max: number): string | null => {
  const trimmed = raw?.trim() ?? '';

  return trimmed ? trimmed.slice(0, max) : null;
};

const imageAt = (field: string, raw: string): RunnerImage => {
  try {
    return RunnerImage.of(raw);
  } catch (error) {
    if (error instanceof InvalidRunnerImageError) {
      throw new InvalidHostReportError(field, error.because);
    }
    throw error;
  }
};

export interface ReportedImage {
  readonly image: string;
  readonly digest?: string;
  readonly usual: boolean;
  readonly release?: string;
  readonly harnesses: readonly {
    readonly id: string;
    readonly models: readonly string[];
    readonly version?: string;
  }[];
  readonly refused?: string;
}

export class HostImage {
  private constructor(
    readonly image: RunnerImage,
    readonly digest: RunnerImage | null,
    readonly usual: boolean,
    readonly release: string | null,
    readonly harnesses: readonly InstalledHarness[],
    readonly refused: string | null,
  ) {}

  static reported(input: ReportedImage): HostImage {
    const digest = input.digest?.trim()
      ? imageAt('images.digest', input.digest)
      : null;

    if (digest && !digest.isPinned) {
      throw new InvalidHostReportError(
        'images.digest',
        'must name the image by its sha256 digest',
      );
    }

    return new HostImage(
      imageAt('images', input.image),
      digest,
      input.usual,
      clipped(input.release, 64),
      input.harnesses.map((each) =>
        InstalledHarness.reported(each.id, each.models, each.version),
      ),
      clipped(input.refused, 500),
    );
  }

  get isServed(): boolean {
    return this.refused === null;
  }

  get servesAHarness(): boolean {
    return this.isServed && this.harnesses.length > 0;
  }

  get running(): RunningImage {
    return RunningImage.of(this.image, this.usual);
  }

  equals(other: HostImage): boolean {
    return (
      this.image.equals(other.image) &&
      sameOrBothNone(this.digest, other.digest) &&
      this.usual === other.usual &&
      this.release === other.release &&
      this.refused === other.refused &&
      this.harnesses.length === other.harnesses.length &&
      this.harnesses.every((each, at) => {
        const theirs = other.harnesses[at];
        return theirs !== undefined && each.equals(theirs);
      })
    );
  }
}
