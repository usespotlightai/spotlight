import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import {
  HostImage,
  type ReportedImage,
} from '@runners/domain/value-objects/host-image.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

const MAX_RUNNING = 1_000;
const MAX_IMAGES = 500;

const bounded = (field: string, raw: string, max: number): string => {
  const held = raw.trim();

  if (!held || held.length > max) {
    throw new InvalidHostReportError(field, `must be 1 to ${max} characters`);
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
      input.capacity > MAX_RUNNING
    ) {
      throw new InvalidHostReportError(
        'capacity',
        `must be a whole number from 1 to ${MAX_RUNNING}`,
      );
    }

    if (new Set(input.running).size > input.capacity) {
      throw new InvalidHostReportError(
        'running',
        'names more runners than its capacity',
      );
    }

    if (input.images.length > MAX_IMAGES) {
      throw new InvalidHostReportError(
        'images',
        `names more than ${MAX_IMAGES} images`,
      );
    }

    const images = input.images.map((each) => HostImage.reported(each));

    if (images.filter((each) => each.usual).length > 1) {
      throw new InvalidHostReportError(
        'images',
        'names more than one default image',
      );
    }

    if (
      images.some((each, at) =>
        images.slice(0, at).some((earlier) => earlier.image.equals(each.image)),
      )
    ) {
      throw new InvalidHostReportError('images', 'names an image twice');
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
