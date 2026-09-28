import { InvalidTaskAsideError } from '@work/domain/exceptions/invalid-task-aside.error';

const MOST_ABOUT = 200;

export class AsideAbout {
  private constructor(readonly value: string) {}

  static of(raw: string): AsideAbout {
    const about = raw.trim();

    if (!about || about.length > MOST_ABOUT) {
      throw new InvalidTaskAsideError(
        `says what it is about in at most ${MOST_ABOUT} characters`,
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
