const ANYONE = 'Someone';

const ANYONE_ON_GITHUB = 'Someone on GitHub';

export class AuthorName {
  private constructor(readonly value: string) {}

  static of(raw: string | null): AuthorName {
    return new AuthorName(raw?.trim() || ANYONE);
  }

  static onGitHub(login: string | null): AuthorName {
    return new AuthorName(login?.trim() || ANYONE_ON_GITHUB);
  }

  equals(other: AuthorName): boolean {
    return this.value === other.value;
  }
}
