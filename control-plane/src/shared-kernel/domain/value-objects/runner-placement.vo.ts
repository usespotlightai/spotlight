import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { distinct } from '@shared-kernel/domain/services/distinct';
import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';

type LabelGroup = readonly string[];

const sameLabelGroup = (a: LabelGroup, b: LabelGroup): boolean =>
  a.length === b.length && a.every((each) => b.includes(each));

export class RunnerPlacement {
  private constructor(
    readonly labelGroups: readonly LabelGroup[],
    readonly image: RunnerImage | null,
  ) {}

  static anywhere(): RunnerPlacement {
    return new RunnerPlacement([], null);
  }

  static of(raw: readonly string[]): RunnerPlacement {
    const labels: string[] = [];

    for (const each of raw) {
      const trimmed = each.trim();

      if (!isSlug(trimmed)) {
        throw new InvalidRunnerPlacementError(
          `must each name a pool or trust label in lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, such as vpc-internal`,
        );
      }

      if (labels.includes(trimmed)) {
        throw new InvalidRunnerPlacementError(`must name ${trimmed} only once`);
      }

      labels.push(trimmed);
    }

    return new RunnerPlacement(labels.length > 0 ? [labels] : [], null);
  }

  static ofLabelGroups(
    raw: readonly LabelGroup[],
    image: RunnerImage | null = null,
  ): RunnerPlacement {
    return RunnerPlacement.every(
      raw.map((each) => RunnerPlacement.of(each)),
    ).in(image);
  }

  static every(placements: readonly RunnerPlacement[]): RunnerPlacement {
    const labelGroups: LabelGroup[] = [];

    for (const group of placements.flatMap((each) => each.labelGroups)) {
      if (!labelGroups.some((existing) => sameLabelGroup(existing, group))) {
        labelGroups.push(group);
      }
    }

    const images = distinct(
      placements.flatMap((each) => (each.image ? [each.image] : [])),
    );

    if (images.length > 1) {
      throw new InvalidRunnerPlacementError(
        `must run in one image, not ${images.map((each) => each.value).join(' and ')}`,
      );
    }

    return new RunnerPlacement(labelGroups, images[0] ?? null);
  }

  in(image: RunnerImage | null): RunnerPlacement {
    return new RunnerPlacement(this.labelGroups, image);
  }

  get isAnywhere(): boolean {
    return this.labelGroups.length === 0 && this.image === null;
  }

  get requiredLabels(): readonly string[] {
    return this.labelGroups.flat();
  }

  or(fallback: RunnerPlacement): RunnerPlacement {
    return this.isAnywhere ? fallback : this;
  }

  matches(offer: RunnerOffer): boolean {
    return (
      this.labelGroups.every((group) =>
        group.some((each) => offer.has(each)),
      ) && offer.supports(this.image)
    );
  }

  equals(other: RunnerPlacement): boolean {
    return (
      this.labelGroups.length === other.labelGroups.length &&
      this.labelGroups.every((group) =>
        other.labelGroups.some((each) => sameLabelGroup(each, group)),
      ) &&
      sameOrBothNone(this.image, other.image)
    );
  }
}
