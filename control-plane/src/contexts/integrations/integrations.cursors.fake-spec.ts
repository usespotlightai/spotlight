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

  stateOf(teamId: TeamId, source: string): PollState | undefined {
    return this.stored.get(this.key(teamId, source));
  }

  setState(teamId: TeamId, source: string, state: PollState): void {
    this.stored.set(this.key(teamId, source), state);
  }

  async read(teamId: TeamId, source: string): Promise<PollState> {
    const state = this.stateOf(teamId, source) ?? { cursor: null, ranAt: null };
    await this.beforeRead();
    return state;
  }

  async claimTurn(
    teamId: TeamId,
    source: string,
    seen: PollState,
    at: Date,
  ): Promise<boolean> {
    const current = this.stateOf(teamId, source);

    if (current && !same(current.ranAt, seen.ranAt)) {
      return false;
    }

    this.setState(teamId, source, {
      cursor: current ? current.cursor : seen.cursor,
      ranAt: at,
    });

    return true;
  }

  async advance(
    teamId: TeamId,
    source: string,
    cursor: string | null,
    claimedAt: Date,
  ): Promise<boolean> {
    const current = this.stateOf(teamId, source);

    if (!current || !same(current.ranAt, claimedAt)) {
      return false;
    }

    this.setState(teamId, source, { cursor, ranAt: claimedAt });

    return true;
  }

  private key(teamId: TeamId, source: string): string {
    return `${teamId.value}:${source}`;
  }
}
