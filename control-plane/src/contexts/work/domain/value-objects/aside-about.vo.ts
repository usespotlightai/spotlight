import { InvalidTaskAsideError } from '@work/domain/exceptions/invalid-task-aside.error';

const MAX_ABOUT = 200;

export class AsideAbout {
  private constructor(readonly value: string) {}

  static of(raw: string): AsideAbout {
    const about = raw.trim();

    if (!about || about.length > MAX_ABOUT) {
      throw new InvalidTaskAsideError(
        `subject must be 1 to ${MAX_ABOUT} characters`,
      );
    }

    return new AsideAbout(about);
  }

  equals(other: AsideAbout): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
