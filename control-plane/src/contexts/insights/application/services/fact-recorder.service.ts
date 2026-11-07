import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';

export interface RecordedAggregates<A> {
  add(aggregate: A): Promise<void>;

  save(aggregate: A): Promise<void>;

  remove(aggregate: A): Promise<void>;
}

export interface Fact<A> {
  readonly owner: FactOwner;
  readonly load: () => Promise<A | null>;
  readonly ownerOf?: (existing: A) => FactOwner;
  readonly fresh?: () => A;
  readonly created?: () => A;
  readonly change: (aggregate: A) => A;
  readonly erased?: (existing: A) => A;
}

export class FactRecorder {
  constructor(private readonly deletions: DeletionsPort) {}

  async record<A>(
    aggregates: RecordedAggregates<A>,
    fact: Fact<A>,
  ): Promise<void> {
    const tombstones = await this.deletions.tombstonesOf(fact.owner);
    const existing = await fact.load();

    if (
      !tombstones.acceptsFacts ||
      (existing !== null &&
        fact.ownerOf &&
        !(await this.deletions.tombstonesOf(fact.ownerOf(existing)))
          .acceptsFacts)
    ) {
      if (existing !== null) {
        await aggregates.remove(fact.erased?.(existing) ?? existing);
      }
      return;
    }

    if (existing === null && fact.created) {
      await aggregates.add(fact.created());
      return;
    }

    const base = existing ?? fact.fresh?.() ?? null;

    if (base === null) {
      return;
    }

    const changed = fact.change(base);

    if (changed === base) {
      return;
    }

    if (existing === null) {
      await aggregates.add(changed);
    } else {
      await aggregates.save(changed);
    }
  }

  async admits(owner: FactOwner): Promise<boolean> {
    return (await this.deletions.tombstonesOf(owner)).acceptsFacts;
  }
}
