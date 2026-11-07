const BELONGING: readonly string[] = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export class AuthorAssociation {
  private readonly kind = 'author-association';

  private constructor(readonly value: string | null) {}

  static of(raw: string | null): AuthorAssociation {
    return new AuthorAssociation(raw?.trim().toUpperCase() || null);
  }

  get isOutside(): boolean {
    return this.value === null || !BELONGING.includes(this.value);
  }

  equals(other: AuthorAssociation): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
