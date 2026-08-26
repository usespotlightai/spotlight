import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@domain/exceptions/revoked-runner.error';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { RunnerName } from '@domain/value-objects/runner-name.vo';
import type { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import type { TokenHash } from '@domain/value-objects/token-hash.vo';

/**
 * A runner someone has enrolled. Its name, its pool and its token are all
 * decided here, before it has ever connected: what a runner may serve is the
 * control plane's to grant, never the runner's to claim.
 */
export class Runner {
  #raised: RunnerRevoked[] = [];

  private constructor(
    readonly id: RunnerId,
    readonly name: RunnerName,
    readonly pool: RunnerPool,
    readonly tokenHash: TokenHash,
    private revokedOn: Date | null,
    private lastSeen: Date | null,
  ) {}

  /** Enrolled from the UI, with a token but no contact yet. */
  static enrol(input: {
    id: RunnerId;
    name: RunnerName;
    pool: RunnerPool;
    tokenHash: TokenHash;
  }): Runner {
    return new Runner(
      input.id,
      input.name,
      input.pool,
      input.tokenHash,
      null,
      null,
    );
  }

  static rehydrate(input: {
    id: RunnerId;
    name: RunnerName;
    pool: RunnerPool;
    tokenHash: TokenHash;
    revokedAt: Date | null;
    lastSeenAt: Date | null;
  }): Runner {
    return new Runner(
      input.id,
      input.name,
      input.pool,
      input.tokenHash,
      input.revokedAt,
      input.lastSeenAt,
    );
  }

  get revokedAt(): Date | null {
    return this.revokedOn;
  }

  get lastSeenAt(): Date | null {
    return this.lastSeen;
  }

  get revoked(): boolean {
    return this.revokedOn !== null;
  }

  /** False until the runner has checked in for the first time. */
  get hasConnected(): boolean {
    return this.lastSeen !== null;
  }

  /**
   * The runner is still there. Every call it makes says so, not just the
   * first: a runner that stops saying it stops being counted on.
   */
  seen(now: Date): void {
    if (this.revoked) {
      throw new RevokedRunnerError();
    }
    this.lastSeen = now;
  }

  /**
   * Retires the token. Nothing holding it can register or claim again, and
   * whatever work this runner was holding is no longer being served, which is
   * what the event says.
   */
  revoke(now: Date): void {
    if (this.revoked) {
      return;
    }

    this.revokedOn = now;
    this.#raised.push(new RunnerRevoked(this.id));
  }

  pullEvents(): readonly RunnerRevoked[] {
    const raised = this.#raised;
    this.#raised = [];
    return raised;
  }
}
