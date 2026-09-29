import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import {
  HostImage,
  type ReportedImage,
} from '@runners/domain/value-objects/host-image.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

const MOST_RUNNING = 1_000;
const MOST_IMAGES = 500;

const bounded = (field: string, raw: string, most: number): string => {
  const held = raw.trim();

  if (!held || held.length > most) {
    throw new InvalidHostReportError(
      field,
      `is between 1 and ${most} characters`,
    );
  }

  return held;
};

export class HostReport {
  private constructor(
    readonly name: string,
    readonly release: string,
    readonly executor: string,
    readonly capacity: number,
    readonly running: readonly RunnerId[],
    readonly images: readonly HostImage[],
  ) {}

  static of(input: {
    name: string;
    release: string;
    executor: string;
    capacity: number;
    running: readonly string[];
    images: readonly ReportedImage[];
  }): HostReport {
    if (
      !Number.isInteger(input.capacity) ||
      input.capacity < 1 ||
      input.capacity > MOST_RUNNING
    ) {
      throw new InvalidHostReportError(
        'capacity',
        `is a whole number from 1 to ${MOST_RUNNING}`,
      );
    }

    if (new Set(input.running).size > input.capacity) {
      throw new InvalidHostReportError(
        'running',
        'names no more runners than its capacity',
      );
    }

    if (input.images.length > MOST_IMAGES) {
      throw new InvalidHostReportError(
        'images',
        `names no more than ${MOST_IMAGES} images`,
      );
    }

    const images = input.images.map((each) => HostImage.reported(each));

    if (images.filter((each) => each.usual).length > 1) {
      throw new InvalidHostReportError(
        'images',
        'names one default image at most',
      );
    }

    if (
      images.some((each, at) =>
        images.slice(0, at).some((earlier) => earlier.image.equals(each.image)),
      )
    ) {
      throw new InvalidHostReportError('images', 'names each image once');
    }

    return new HostReport(
      bounded('name', input.name, 120),
      bounded('release', input.release, 64),
      bounded('executor', input.executor, 200),
      input.capacity,
      [...new Set(input.running)].map((id) => RunnerId.of(id)),
      images,
    );
  }

  get servesAHarness(): boolean {
    return this.images.some((each) => each.servesAHarness);
  }

  offering(image: RunnerImage): HostImage | null {
    return (
      this.images.find((each) => each.isServed && each.image.equals(image)) ??
      null
    );
  }
}
