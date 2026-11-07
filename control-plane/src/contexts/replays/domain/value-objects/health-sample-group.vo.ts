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

  equals(other: HealthSampleGroup): boolean {
    return this.value === other.value;
  }
}
