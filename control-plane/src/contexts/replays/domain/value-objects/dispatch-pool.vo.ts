import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DispatchPool {
  private readonly kind = 'dispatch-pool';

  private constructor(readonly value: string) {}

  static ofSearch(searchId: SearchId): DispatchPool {
    return new DispatchPool(`search:${searchId.value}`);
  }

  static ofTeam(teamId: TeamId): DispatchPool {
    return new DispatchPool(`team:${teamId.value}`);
  }

  equals(other: DispatchPool): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
