import { InvalidWorkspaceSlugError } from '@domain/exceptions/invalid-workspace-slug.error';

const MAX_LENGTH = 48;
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class WorkspaceSlug {
  private constructor(readonly value: string) {}

  static of(raw: string): WorkspaceSlug {
    const candidate = raw.trim().toLowerCase();

    if (candidate.length === 0) {
      throw new InvalidWorkspaceSlugError('must not be empty');
    }
    if (candidate.length > MAX_LENGTH) {
      throw new InvalidWorkspaceSlugError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }
    if (!SHAPE.test(candidate)) {
      throw new InvalidWorkspaceSlugError(
        'may only contain letters, numbers and single dashes between them',
      );
    }
    return new WorkspaceSlug(candidate);
  }

  equals(other: WorkspaceSlug): boolean {
    return this.value === other.value;
  }
}
