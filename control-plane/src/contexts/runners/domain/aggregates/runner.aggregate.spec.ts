import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@runners/domain/exceptions/revoked-runner.error';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const has = (id: string, ...models: string[]) =>
  InstalledHarness.reported(id, models);

const NOW = new Date('2026-08-25T10:00:00.000Z');
const LATER = new Date('2026-08-25T11:00:00.000Z');

const HASH = 'a'.repeat(64);
const WORKSPACE = WorkspaceId.of('ws_1');

const fresh = () =>
  Runner.enrol({
    id: RunnerId.of('runner_1'),
    workspaceId: WORKSPACE,
    name: RunnerName.of('Laptop'),
    tokenHash: TokenHash.of(HASH),
  });

const enrolled = () => {
  const runner = fresh();
  runner.pullEvents();
  return runner;
};

const kinds = (runner: Runner) => runner.pullEvents().map((each) => each.kind);

describe('Runner', () => {
  it('says it was enrolled, and in which workspace', () => {
    const [event] = fresh().pullEvents();

    expect(event).toBeInstanceOf(RunnerEnrolled);
    expect((event as RunnerEnrolled).workspaceId.equals(WORKSPACE)).toBe(true);
  });

  it('belongs to the workspace it was enrolled in', () => {
    expect(enrolled().belongsTo(WORKSPACE)).toBe(true);
    expect(enrolled().belongsTo(WorkspaceId.of('ws_2'))).toBe(false);
  });

  it('knows of no harnesses before it has ever connected', () => {
    const runner = enrolled();

    expect(runner.harnesses).toEqual([]);
    expect(runner.hasConnected).toBe(false);
    expect(runner.revoked).toBe(false);
  });

  it('records what the runner says it found, and that it was heard from', () => {
    const runner = enrolled().register([has('claude-code'), has('other')], NOW);

    expect(runner.harnesses.map((each) => each.value)).toEqual([
      'claude-code',
      'other',
    ]);
    expect(runner.lastSeenAt).toEqual(NOW);
  });

  it('records the models a harness advertises', () => {
    const runner = enrolled().register(
      [has('claude-code', 'claude-sonnet-5', 'claude-opus-4-8')],
      NOW,
    );

    expect(
      runner.modelsOf(HarnessId.of('claude-code')).map((each) => each.value),
    ).toEqual(['claude-sonnet-5', 'claude-opus-4-8']);
  });

  it('does not advertise a model the machine could not name', () => {
    const runner = enrolled().register(
      [has('claude-code', 'claude-sonnet-5', '  ', 'x'.repeat(61))],
      NOW,
    );

    expect(
      runner.modelsOf(HarnessId.of('claude-code')).map((each) => each.value),
    ).toEqual(['claude-sonnet-5']);
  });

  it('takes the latest word as the whole truth', () => {
    const runner = enrolled()
      .register([has('claude-code'), has('other')], NOW)
      .register([has('other')], LATER);

    expect(runner.harnesses.map((each) => each.value)).toEqual(['other']);
  });

  it('says it registered, and what it reported, the first time', () => {
    expect(kinds(enrolled().register([has('claude-code')], NOW))).toEqual([
      'runner.registered',
      'runner.reported-harnesses',
    ]);
  });

  it('says nothing was reported when the machine still has the same', () => {
    const runner = enrolled().register([has('claude-code', 'm')], NOW);
    runner.pullEvents();

    expect(kinds(runner.register([has('claude-code', 'm')], LATER))).toEqual([
      'runner.registered',
    ]);
  });

  it('will not hear from a runner whose token was retired', () => {
    const runner = enrolled().revoke(NOW);

    expect(() => runner.register([has('claude-code')], LATER)).toThrow(
      RevokedRunnerError,
    );
  });

  it('keeps its identity across a restart', () => {
    const runner = enrolled().seen(NOW).seen(LATER);

    expect(runner.id.value).toBe('runner_1');
    expect(runner.hasConnected).toBe(true);
    expect(runner.lastSeenAt).toEqual(LATER);
  });

  it('raises nothing for being seen', () => {
    expect(kinds(enrolled().seen(NOW))).toEqual([]);
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

  it('leaves the runner it was revoked from untouched', () => {
    const runner = enrolled();
    runner.revoke(NOW);

    expect(runner.pullEvents()).toHaveLength(0);
    expect(runner.revoked).toBe(false);
  });

  it('carries the version it was read at through every change', () => {
    const read = Runner.rehydrate({
      id: RunnerId.of('runner_1'),
      workspaceId: WORKSPACE,
      name: RunnerName.of('Laptop'),
      tokenHash: TokenHash.of(HASH),
      installed: [],
      revokedAt: null,
      lastSeenAt: null,
      version: 7,
    });

    expect(read.register([has('claude-code')], NOW).seen(LATER).version).toBe(
      7,
    );
  });

  it('will not be read back at an impossible version', () => {
    expect(() =>
      Runner.rehydrate({
        id: RunnerId.of('runner_1'),
        workspaceId: WORKSPACE,
        name: RunnerName.of('Laptop'),
        tokenHash: TokenHash.of(HASH),
        installed: [],
        revokedAt: null,
        lastSeenAt: null,
        version: -1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
