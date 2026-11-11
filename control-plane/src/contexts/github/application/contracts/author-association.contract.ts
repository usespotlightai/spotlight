import { AuthorAssociation } from '@github/domain/value-objects/author-association.vo';

export const isOutsideAuthor = (association: string | null): boolean =>
  AuthorAssociation.of(association).isOutside;
