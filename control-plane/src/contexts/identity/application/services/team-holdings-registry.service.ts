import type {
  TeamHolder,
  TeamHoldingsPort,
} from '@identity/application/ports/team-holdings.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamHoldingsRegistry implements TeamHoldingsPort {
  private readonly holders: TeamHolder[] = [];

  register(holder: TeamHolder): void {
    this.holders.push(holder);
  }

  async of(teamId: TeamId): Promise<readonly string[]> {
    const held: string[] = [];

    for (const holder of this.holders) {
      held.push(...(await holder.heldBy(teamId)));
    }

    return held;
  }
}
