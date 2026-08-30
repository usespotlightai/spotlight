import { Runner } from '@domain/aggregates/runner.aggregate';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@domain/exceptions/revoked-runner.error';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const LATER = new Date('2026-08-25T11:00:00.000Z');

const HASH = 'a'.repeat(64);

const enrolled = () =>
  Runner.enrol({
    id: RunnerId.of('runner_1'),
    name: RunnerName.of('Laptop'),
    tokenHash: TokenHash.of(HASH),
  });

describe('Runner', () => {
  // What is installed is a fact about the machine, and the machine has not
  // spoken yet.
  it('knows of no harnesses before it has ever connected', () => {
    const runner = enrolled();

    expect(runner.harnesses).toEqual([]);
    expect(runner.hasConnected).toBe(false);
    expect(runner.revoked).toBe(false);
  });

  it('records what the runner says it found', () => {
    const runner = enrolled();

    runner.reports([HarnessId.of('claude-code'), HarnessId.of('other')]);

    expect(runner.harnesses.map((each) => each.value)).toEqual([
      'claude-code',
      'other',
    ]);
  });

  // A machine that loses a tool says so by not mentioning it, so what it
  // reports replaces what it said before rather than adding to it.
  it('takes the latest word as the whole truth', () => {
    const runner = enrolled();

    runner.reports([HarnessId.of('claude-code'), HarnessId.of('other')]);
    runner.reports([HarnessId.of('other')]);

    expect(runner.harnesses.map((each) => each.value)).toEqual(['other']);
  });

  it('will not hear from a runner whose token was retired', () => {
    const runner = enrolled();
    runner.revoke(NOW);

    expect(() => runner.reports([HarnessId.of('claude-code')])).toThrow(
      RevokedRunnerError,
    );
  });

  it('keeps its identity across a restart', () => {
    const runner = enrolled();

    runner.seen(NOW);
    runner.seen(LATER);

    expect(runner.id.value).toBe('runner_1');
    expect(runner.hasConnected).toBe(true);
    expect(runner.lastSeenAt).toEqual(LATER);
  });

  it('refuses to be seen once its token is revoked', () => {
    const runner = enrolled();
    runner.revoke(NOW);

    expect(() => runner.seen(LATER)).toThrow(RevokedRunnerError);
  });

  it('keeps the moment it was first revoked', () => {
    const runner = enrolled();

    runner.revoke(NOW);
    runner.revoke(LATER);

    expect(runner.revokedAt).toEqual(NOW);
  });

  it('says so once, so the work it held is released once', () => {
    const runner = enrolled();

    runner.revoke(NOW);
    runner.revoke(LATER);

    const raised = runner.pullEvents();
    expect(raised).toHaveLength(1);
    expect(raised[0]).toBeInstanceOf(RunnerRevoked);
    expect(raised[0].runnerId.value).toBe('runner_1');
  });

  it('raises nothing until it is revoked', () => {
    expect(enrolled().pullEvents()).toHaveLength(0);
  });

  it('hands each event over only once', () => {
    const runner = enrolled();
    runner.revoke(NOW);

    expect(runner.pullEvents()).toHaveLength(1);
    expect(runner.pullEvents()).toHaveLength(0);
  });
});
