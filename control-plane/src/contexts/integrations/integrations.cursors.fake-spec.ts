import { PollCursor } from '@integrations/domain/aggregates/poll-cursor.aggregate';
import { ScheduleCursor } from '@integrations/domain/aggregates/schedule-cursor.aggregate';
import { PollCursorVersionConflictError } from '@integrations/domain/exceptions/poll-cursor-version-conflict.error';
import { ScheduleCursorVersionConflictError } from '@integrations/domain/exceptions/schedule-cursor-version-conflict.error';
import type { PollCursorRepository } from '@integrations/domain/repositories/poll-cursor.repository';
import type { ScheduleCursorRepository } from '@integrations/domain/repositories/schedule-cursor.repository';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface PollState {
  readonly cursor: string | null;
  readonly polledAt: Date | null;
}

export interface ScheduleState {
  readonly ranAt: Date;
}

type Versioned<S> = S & { readonly version: number };

const keyOf = (teamId: TeamId, integration: string): string =>
  `${teamId.value}:${integration}`;

class VersionedStore<S> {
  private readonly stored = new Map<string, Versioned<S>>();

  stateOf(teamId: TeamId, integration: string): S | undefined {
    const found = this.stored.get(keyOf(teamId, integration));

    if (!found) {
      return undefined;
    }

    const { version: _version, ...state } = found;

    return state as unknown as S;
  }

  versioned(teamId: TeamId, integration: string): Versioned<S> | undefined {
    return this.stored.get(keyOf(teamId, integration));
  }

  setState(teamId: TeamId, integration: string, state: S): void {
    const current = this.stored.get(keyOf(teamId, integration));

    this.stored.set(keyOf(teamId, integration), {
      ...state,
      version: (current?.version ?? 0) + 1,
    });
  }

  saved(
    teamId: TeamId,
    integration: string,
    isNew: boolean,
    version: number,
    state: S,
  ): boolean {
    const current = this.stored.get(keyOf(teamId, integration));

    if (isNew ? current !== undefined : current?.version !== version) {
      return false;
    }

    this.setState(teamId, integration, state);

    return true;
  }
}

export class FakePollCursors implements PollCursorRepository {
  private readonly store = new VersionedStore<PollState>();

  constructor(
    private readonly beforeRead: () => Promise<void> = async () => {},
  ) {}

  stateOf(teamId: TeamId, integration: string): PollState | undefined {
    return this.store.stateOf(teamId, integration);
  }

  setState(teamId: TeamId, integration: string, state: PollState): void {
    this.store.setState(teamId, integration, state);
  }

  async of(teamId: TeamId, integration: IntegrationKey): Promise<PollCursor> {
    const found = this.store.versioned(teamId, integration.value);
    await this.beforeRead();

    return found
      ? PollCursor.rehydrate({ teamId, integration, ...found })
      : PollCursor.start(teamId, integration);
  }

  async save(cursor: PollCursor): Promise<void> {
    const saved = this.store.saved(
      cursor.teamId,
      cursor.integration.value,
      cursor.isNew,
      cursor.version,
      { cursor: cursor.cursor, polledAt: cursor.polledAt },
    );

    if (!saved) {
      throw new PollCursorVersionConflictError(cursor.integration.value);
    }
  }
}

export class FakeScheduleCursors implements ScheduleCursorRepository {
  private readonly store = new VersionedStore<ScheduleState>();

  constructor(
    private readonly beforeRead: () => Promise<void> = async () => {},
  ) {}

  stateOf(teamId: TeamId, integration: string): ScheduleState | undefined {
    return this.store.stateOf(teamId, integration);
  }

  setState(teamId: TeamId, integration: string, state: ScheduleState): void {
    this.store.setState(teamId, integration, state);
  }

  async of(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<ScheduleCursor> {
    const found = this.store.versioned(teamId, integration.value);
    await this.beforeRead();

    return found
      ? ScheduleCursor.rehydrate({ teamId, integration, ...found })
      : ScheduleCursor.start(teamId, integration);
  }

  async save(cursor: ScheduleCursor): Promise<void> {
    const ranAt = cursor.ranAt;
    const saved =
      ranAt !== null &&
      this.store.saved(
        cursor.teamId,
        cursor.integration.value,
        cursor.isNew,
        cursor.version,
        { ranAt },
      );

    if (!saved) {
      throw new ScheduleCursorVersionConflictError(cursor.integration.value);
    }
  }
}
