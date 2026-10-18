import type {
  IntegrationCursorsPort,
  PollState,
} from '@integrations/application/ports/integration-cursors.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const same = (one: Date | null, other: Date | null): boolean =>
  one?.getTime() === other?.getTime();

export class FakeIntegrationCursors implements IntegrationCursorsPort {
  private readonly stored = new Map<string, PollState>();

  constructor(
    private readonly beforeRead: () => Promise<void> = async () => {},
  ) {}

  stateOf(teamId: TeamId, integration: string): PollState | undefined {
    return this.stored.get(this.key(teamId, integration));
  }

  setState(teamId: TeamId, integration: string, state: PollState): void {
    this.stored.set(this.key(teamId, integration), state);
  }

  async read(teamId: TeamId, integration: string): Promise<PollState> {
    const state = this.stateOf(teamId, integration) ?? {
      cursor: null,
      ranAt: null,
    };
    await this.beforeRead();
    return state;
  }

  async claimTurn(
    teamId: TeamId,
    integration: string,
    seen: PollState,
    at: Date,
  ): Promise<boolean> {
    const current = this.stateOf(teamId, integration);

    if (current && !same(current.ranAt, seen.ranAt)) {
      return false;
    }

    this.setState(teamId, integration, {
      cursor: current ? current.cursor : seen.cursor,
      ranAt: at,
    });

    return true;
  }

  async advance(
    teamId: TeamId,
    integration: string,
    cursor: string | null,
    claimedAt: Date,
  ): Promise<boolean> {
    const current = this.stateOf(teamId, integration);

    if (!current || !same(current.ranAt, claimedAt)) {
      return false;
    }

    this.setState(teamId, integration, { cursor, ranAt: claimedAt });

    return true;
  }

  private key(teamId: TeamId, integration: string): string {
    return `${teamId.value}:${integration}`;
  }
}
