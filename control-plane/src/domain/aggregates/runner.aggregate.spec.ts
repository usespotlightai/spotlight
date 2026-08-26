import { Runner } from '@domain/aggregates/runner.aggregate';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { InvalidRunnerPoolError } from '@domain/exceptions/invalid-runner-pool.error';
import { RevokedRunnerError } from '@domain/exceptions/revoked-runner.error';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const LATER = new Date('2026-08-25T11:00:00.000Z');

const HASH = 'a'.repeat(64);

const enrolled = () =>
  Runner.enrol({
    id: RunnerId.of('runner_1'),
    name: RunnerName.of('Laptop'),
    pool: RunnerPool.of('dev'),
    tokenHash: TokenHash.of(HASH),
  });

describe('Runner', () => {
  it('knows its pool before it has ever connected', () => {
    const runner = enrolled();

    expect(runner.pool.value).toBe('dev');
    expect(runner.hasConnected).toBe(false);
    expect(runner.revoked).toBe(false);
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

  it('refuses a pool that is no pool at all', () => {
    expect(() => RunnerPool.of('   ')).toThrow(InvalidRunnerPoolError);
  });

  it('takes a pool without the whitespace around it', () => {
    expect(RunnerPool.of('  dev  ').value).toBe('dev');
  });
});
