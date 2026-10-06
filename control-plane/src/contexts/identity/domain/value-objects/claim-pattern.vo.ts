import { InvalidTokenTrustError } from '@identity/domain/exceptions/invalid-token-trust.error';

const LONGEST = 255;

const WILDCARD = '*';

export class ClaimPattern {
  private readonly kind = 'claim-pattern';

  private constructor(readonly value: string) {}

  static of(raw: string, field = 'subject'): ClaimPattern {
    const held = raw.trim();

    if (!held || held.length > LONGEST || /\s/.test(held)) {
      throw new InvalidTokenTrustError(
        field,
        `must be one word of at most ${LONGEST} characters, as in repo:acme/platform:ref:refs/heads/*`,
      );
    }

    return new ClaimPattern(held);
  }

  get isExact(): boolean {
    return !this.value.includes(WILDCARD);
  }

  get literalStart(): string {
    const wildcard = this.value.indexOf(WILDCARD);

    return wildcard < 0 ? this.value : this.value.slice(0, wildcard);
  }

  matches(claimed: string): boolean {
    const pattern = this.value;
    let at = 0;
    let from = 0;
    let star = -1;
    let resumeAt = 0;

    while (at < claimed.length) {
      if (from < pattern.length && pattern[from] === WILDCARD) {
        star = from;
        resumeAt = at;
        from += 1;
      } else if (from < pattern.length && pattern[from] === claimed[at]) {
        from += 1;
        at += 1;
      } else if (star >= 0) {
        from = star + 1;
        resumeAt += 1;
        at = resumeAt;
      } else {
        return false;
      }
    }

    while (from < pattern.length && pattern[from] === WILDCARD) {
      from += 1;
    }

    return from === pattern.length;
  }

  equals(other: ClaimPattern): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
