import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import { TerraformStateLockLostError } from '@configuration/domain/exceptions/terraform-state-lock-lost.error';
import { TerraformStateLockNotYoursError } from '@configuration/domain/exceptions/terraform-state-lock-not-yours.error';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-26T10:00:00Z');

const opened = () =>
  TerraformState.open({
    id: TerraformStateId.of('state_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    name: StateName.of('default'),
  });

const lock = (id: string) =>
  StateLock.of({
    info: { ID: id, Operation: 'OperationTypeApply', Who: 'ci@runner' },
    lockedBy: 'token:tok_1',
    lockedAt: AT,
  });

const snapshot = (serial: number) =>
  StateSnapshot.of({
    serial,
    lineage: 'b0a1c2d3',
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    size: 120,
  });

const holder = { principal: 'token:tok_1', mayForce: false };

const writing = (lockId: string | null, id = 'version_1') => ({
  id: StateVersionId.of(id),
  snapshot: snapshot(1),
  lockId,
  by: 'token:tok_1',
  at: AT,
});

describe('TerraformState', () => {
  it('opens with no lock and no version', () => {
    const state = opened();

    expect(state.isNew).toBe(true);
    expect(state.lock).toBeNull();
    expect(state.latest).toBeNull();
    expect(state.written).toBeNull();
  });

  it('takes a free lock', () => {
    expect(opened().lockAs(lock('a')).lock?.id).toBe('a');
  });

  it('keeps a lock the same holder takes again', () => {
    const locked = opened().lockAs(lock('a'));

    expect(locked.lockAs(lock('a'))).toBe(locked);
  });

  it('refuses a lock another holder has, and names the holder', () => {
    const locked = opened().lockAs(lock('a'));

    expect(() => locked.lockAs(lock('b'))).toThrow(TerraformStateLockedError);

    try {
      locked.lockAs(lock('b'));
    } catch (error) {
      expect((error as TerraformStateLockedError).holder.id).toBe('a');
    }
  });

  it('refuses the same lock ID from another principal', () => {
    const locked = opened().lockAs(lock('a'));
    const replayed = StateLock.of({
      info: { ID: 'a' },
      lockedBy: 'token:tok_2',
      lockedAt: AT,
    });

    expect(() => locked.lockAs(replayed)).toThrow(TerraformStateLockedError);
  });

  it('writes without a lock ID while no lock is held', () => {
    expect(opened().write(writing(null)).version.number).toBe(1);
  });

  it('releases the lock only for its ID', () => {
    const locked = opened().lockAs(lock('a'));

    expect(() => locked.unlock('b', holder)).toThrow(TerraformStateLockedError);
    expect(locked.unlock('a', holder).lock).toBeNull();
  });

  it('lets only the principal that took the lock release it, unless it may force', () => {
    const locked = opened().lockAs(lock('a'));
    const other = { principal: 'token:tok_2', mayForce: false };

    expect(() => locked.unlock('a', other)).toThrow(
      TerraformStateLockNotYoursError,
    );
    expect(locked.unlock('a', { ...other, mayForce: true }).lock).toBeNull();
  });

  it('releases any holder’s lock when forced', () => {
    const locked = opened().lockAs(lock('a'));

    expect(locked.forceUnlock().lock).toBeNull();
    expect(opened().forceUnlock().lock).toBeNull();
  });

  it('treats releasing a free lock as done', () => {
    const state = opened();

    expect(state.unlock('a', holder)).toBe(state);
  });

  it('writes the first version as number 1, and the next as 2', () => {
    const first = opened().write(writing(null, 'version_1'));
    const second = first.state.write(writing(null, 'version_2'));

    expect(first.version.number).toBe(1);
    expect(second.state.latest?.number).toBe(2);
    expect(second.state.written?.id.value).toBe('version_2');
  });

  it('refuses a write without the lock while another holder has it', () => {
    const locked = opened().lockAs(lock('a'));

    expect(() => locked.write(writing(null))).toThrow(
      TerraformStateLockedError,
    );
    expect(() => locked.write(writing('b'))).toThrow(TerraformStateLockedError);
    expect(locked.write(writing('a')).state.latest?.number).toBe(1);
  });

  it('keeps the lock after a write', () => {
    const { state } = opened().lockAs(lock('a')).write(writing('a'));

    expect(state.lock?.id).toBe('a');
  });

  it('refuses a write that names a lock no one holds any more', () => {
    const released = opened().lockAs(lock('a')).forceUnlock();

    expect(() => released.write(writing('a'))).toThrow(
      TerraformStateLockLostError,
    );
  });

  it('refuses a stored state without a version', () => {
    expect(() =>
      TerraformState.rehydrate({
        id: TerraformStateId.of('state_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        name: StateName.of('default'),
        lock: null,
        latest: null,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});
