import type { RunnerId } from '@domain/value-objects/runner-id.vo';

/**
 * A registered runner. It advertises what it can serve and nothing more: the
 * control plane decides what it may have, so anything it says about itself is
 * a hint, never a permission.
 */
export class Runner {
  private constructor(
    readonly id: RunnerId,
    readonly pool: string,
    readonly labels: Readonly<Record<string, string>>,
  ) {}

  static register(input: {
    id: RunnerId;
    pool: string;
    labels?: Record<string, string>;
  }): Runner {
    return new Runner(input.id, input.pool, { ...(input.labels ?? {}) });
  }
}
