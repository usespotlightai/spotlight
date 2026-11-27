const BELONGING: readonly string[] = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export class AuthorAssociation {
  private readonly kind: string = 'author-association';

  private constructor(readonly value: string | null) {}

  static of(raw: string | null): AuthorAssociation {
    const named = raw?.trim().toUpperCase();

    return new AuthorAssociation(
      named === undefined || named === '' ? null : named,
    );
  }

  get isOutside(): boolean {
    return this.value === null || !BELONGING.includes(this.value);
  }

  equals(other: AuthorAssociation): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
