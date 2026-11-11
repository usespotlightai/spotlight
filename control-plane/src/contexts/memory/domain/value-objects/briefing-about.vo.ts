export class BriefingAbout {
  private readonly kind = 'briefing-about';

  private constructor(readonly value: string) {}

  static of(raw: string): BriefingAbout {
    return new BriefingAbout(raw.trim());
  }

  get isEmpty(): boolean {
    return this.value.length === 0;
  }

  equals(other: BriefingAbout): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
