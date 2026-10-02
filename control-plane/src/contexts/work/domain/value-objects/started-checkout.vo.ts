import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';

const FULL_COMMIT = /^[0-9a-f]{40}$/;

export interface StartedCheckoutParts {
  readonly path: string;
  readonly commit: string;
}

export class StartedCheckout {
  private constructor(
    readonly path: string,
    readonly commit: string,
  ) {}

  static of(parts: StartedCheckoutParts): StartedCheckout {
    const path = parts.path.trim();
    const commit = parts.commit.trim();

    if (!path) {
      throw new InvalidStartingPointError('names each checkout by its path');
    }

    if (!FULL_COMMIT.test(commit)) {
      throw new InvalidStartingPointError(
        `names the commit ${path} began at by its full SHA, not ${commit || 'nothing'}`,
      );
    }

    return new StartedCheckout(path, commit);
  }

  get parts(): StartedCheckoutParts {
    return { path: this.path, commit: this.commit };
  }

  equals(other: StartedCheckout): boolean {
    return this.path === other.path && this.commit === other.commit;
  }
}
