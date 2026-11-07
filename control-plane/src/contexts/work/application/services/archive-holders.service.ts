import type {
  ArchiveHolderSource,
  ArchiveHoldersPort,
} from '@work/application/ports/archive-holders.port';
import type { HolderState } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { RequesterOwner } from '@work/domain/value-objects/run-requester.vo';
import type { WorkspaceKey } from '@work/domain/value-objects/workspace-key.vo';

export class ArchiveHolders implements ArchiveHoldersPort {
  private readonly sources = new Map<string, ArchiveHolderSource>();

  register(source: ArchiveHolderSource): void {
    this.sources.set(source.owner, source);
  }

  holds(owner: RequesterOwner): boolean {
    return this.sources.has(owner.value);
  }

  async stateOf(
    keys: readonly WorkspaceKey[],
  ): Promise<ReadonlyMap<string, HolderState | null>> {
    const byOwner = new Map<string, WorkspaceKey[]>();

    for (const key of keys) {
      byOwner.set(key.owner.value, [
        ...(byOwner.get(key.owner.value) ?? []),
        key,
      ]);
    }

    const states = new Map<string, HolderState | null>();

    for (const [owner, owned] of byOwner) {
      const source = this.sources.get(owner);
      const held = source
        ? await source.heldOf([...new Set(owned.map((each) => each.name))])
        : new Map();

      for (const key of owned) {
        states.set(key.value, held.get(key.name) ?? null);
      }
    }

    return states;
  }
}
