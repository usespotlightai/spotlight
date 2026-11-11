import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class HealthSampleGroup {
  private constructor(readonly value: string) {}

  static of(input: {
    readonly live: boolean;
    readonly calibration: boolean;
    readonly repeats: number;
  }): HealthSampleGroup {
    return new HealthSampleGroup(
      [
        input.live ? 'live' : 'other',
        input.calibration ? 'calibration' : 'plain',
        input.repeats,
      ].join(':'),
    );
  }

  static rehydrate(value: string): HealthSampleGroup {
    const [live, calibration, repeats] = value.split(':');
    const group = HealthSampleGroup.of({
      live: live === 'live',
      calibration: calibration === 'calibration',
      repeats: Number(repeats),
    });

    if (group.value !== value) {
      throw new InconsistentStateError(
        'health sample group',
        `is not a group of health samples, ${value}`,
      );
    }

    return group;
  }

  equals(other: HealthSampleGroup): boolean {
    return this.value === other.value;
  }
}
