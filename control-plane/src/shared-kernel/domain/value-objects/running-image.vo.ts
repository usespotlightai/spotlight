import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

export class RunningImage {
  private constructor(
    readonly image: RunnerImage,
    readonly usual: boolean,
  ) {}

  static of(image: RunnerImage, usual: boolean): RunningImage {
    return new RunningImage(image, usual);
  }

  serves(wanted: RunnerImage | null): boolean {
    return wanted ? wanted.equals(this.image) : this.usual;
  }

  equals(other: RunningImage): boolean {
    return this.image.equals(other.image) && this.usual === other.usual;
  }
}
