import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

export class RunningImage {
  private constructor(
    readonly image: RunnerImage,
    readonly isDefault: boolean,
  ) {}

  static of(image: RunnerImage, isDefault: boolean): RunningImage {
    return new RunningImage(image, isDefault);
  }

  serves(wanted: RunnerImage | null): boolean {
    return wanted ? wanted.equals(this.image) : this.isDefault;
  }

  equals(other: RunningImage): boolean {
    return this.image.equals(other.image) && this.isDefault === other.isDefault;
  }
}
