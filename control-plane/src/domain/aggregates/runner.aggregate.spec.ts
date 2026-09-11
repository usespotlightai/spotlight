import { Runner } from '@domain/aggregates/runner.aggregate';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@domain/exceptions/revoked-runner.error';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

/** One installed harness, with any models it advertises. */
const has = (id: string, ...models: string[]) => ({
  id: HarnessId.of(id),
  models: models.map(HarnessModel.of),
});

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
    const runner = enrolled().reports([has('claude-code'), has('other')]);

    expect(runner.harnesses.map((each) => each.value)).toEqual([
      'claude-code',
      'other',
    ]);
  });

  // What each harness can answer with is the machine's to say too, kept with
  // the harness it belongs to.
  it('records the models a harness advertises', () => {
    const runner = enrolled().reports([
      has('claude-code', 'claude-sonnet-5', 'claude-opus-4-8'),
    ]);

    expect(
      runner.modelsOf(HarnessId.of('claude-code')).map((each) => each.value),
    ).toEqual(['claude-sonnet-5', 'claude-opus-4-8']);
  });

  // A machine that loses a tool says so by not mentioning it, so what it
  // reports replaces what it said before rather than adding to it.
  it('takes the latest word as the whole truth', () => {
    const runner = enrolled()
      .reports([has('claude-code'), has('other')])
      .reports([has('other')]);

    expect(runner.harnesses.map((each) => each.value)).toEqual(['other']);
  });

  it('will not hear from a runner whose token was retired', () => {
    const runner = enrolled().revoke(NOW);

    expect(() => runner.reports([has('claude-code')])).toThrow(
      RevokedRunnerError,
    );
  });

  it('keeps its identity across a restart', () => {
    const runner = enrolled().seen(NOW).seen(LATER);

    expect(runner.id.value).toBe('runner_1');
    expect(runner.hasConnected).toBe(true);
    expect(runner.lastSeenAt).toEqual(LATER);
  });

  it('refuses to be seen once its token is revoked', () => {
    const runner = enrolled().revoke(NOW);

    expect(() => runner.seen(LATER)).toThrow(RevokedRunnerError);
  });

  it('keeps the moment it was first revoked', () => {
    const events = enrolled().revoke(NOW).revoke(LATER).pullEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(RunnerRevoked);
    expect((events[0] as RunnerRevoked).runnerId.value).toBe('runner_1');
  });

  it('raises nothing until it is revoked', () => {
    expect(enrolled().pullEvents()).toHaveLength(0);
  });

  // What a change raised belongs to the runner that change made, so the one
  // it was made from still says nothing happened.
  it('leaves the runner it was revoked from untouched', () => {
    const runner = enrolled();
    runner.revoke(NOW);

    expect(runner.pullEvents()).toHaveLength(0);
    expect(runner.revoked).toBe(false);
  });
});
