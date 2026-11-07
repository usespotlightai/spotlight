import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { InvalidRunRequesterError } from '@work/domain/exceptions/invalid-run-requester.error';

const SLUG = /^[a-z][a-z0-9-]*$/;

export class RequesterOwner {
  private constructor(readonly value: string) {}

  static of(value: string): RequesterOwner {
    if (!SLUG.test(value)) {
      throw new InvalidRunRequesterError(
        `owner must be a lowercase slug, not ${JSON.stringify(value)}`,
      );
    }

    return new RequesterOwner(value);
  }

  equals(other: RequesterOwner): boolean {
    return this.value === other.value;
  }
}

export class RunRequester {
  private constructor(
    readonly owner: RequesterOwner,
    readonly kind: string,
    readonly id: string,
    readonly token: string | null,
    readonly team: TeamId | null,
  ) {}

  static of(input: {
    owner: string;
    kind: string;
    id: string;
    token?: string | null;
    team: TeamId | null;
  }): RunRequester {
    if (!SLUG.test(input.kind)) {
      throw new InvalidRunRequesterError(
        `kind must be a lowercase slug, not ${JSON.stringify(input.kind)}`,
      );
    }

    if (input.id.trim() === '') {
      throw new InvalidRunRequesterError('needs an id');
    }

    return new RunRequester(
      RequesterOwner.of(input.owner),
      input.kind,
      input.id,
      input.token ?? null,
      input.team,
    );
  }

  get subject(): string {
    return `${this.owner.value}/${this.kind}/${this.id}`;
  }

  equals(other: RunRequester): boolean {
    return (
      this.subject === other.subject &&
      this.token === other.token &&
      (this.team === null
        ? other.team === null
        : other.team !== null && this.team.equals(other.team))
    );
  }
}
