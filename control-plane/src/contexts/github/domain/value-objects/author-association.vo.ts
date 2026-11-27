import { nonEmpty } from '@shared-kernel/domain/non-empty';
const BELONGING: readonly string[] = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export class AuthorAssociation {
  private readonly kind = 'author-association';

  private constructor(readonly value: string | null) {}

  static of(raw: string | null): AuthorAssociation {
    const named = raw?.trim().toUpperCase();

    return new AuthorAssociation(!nonEmpty(named) ? null : named);
  }

  get isOutside(): boolean {
    return this.value === null || !BELONGING.includes(this.value);
  }

  equals(other: AuthorAssociation): boolean {
    return other instanceof AuthorAssociation && this.value === other.value;
  }
}
