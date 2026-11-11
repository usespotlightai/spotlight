import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';
import { TerraformStateDivergedError } from '@configuration/domain/exceptions/terraform-state-diverged.error';
import { TerraformStateLineageMismatchError } from '@configuration/domain/exceptions/terraform-state-lineage-mismatch.error';
import { TerraformStateLockLostError } from '@configuration/domain/exceptions/terraform-state-lock-lost.error';
import { TerraformStateLockNotYoursError } from '@configuration/domain/exceptions/terraform-state-lock-not-yours.error';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import { TerraformStateSerialBehindError } from '@configuration/domain/exceptions/terraform-state-serial-behind.error';
import { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { StateLockId } from '@configuration/domain/value-objects/state-lock-id.vo';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
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
    id: StateLockId.of(id),
    operation: 'OperationTypeApply',
    asWritten: { ID: id, Operation: 'OperationTypeApply', Who: 'ci@runner' },
    lockedBy: PrincipalRef.rehydrate('token:tok_1'),
    lockedAt: AT,
  });

const lockId = (raw: string) => StateLockId.of(raw);

const snapshot = (
  serial: number,
  lineage = 'b0a1c2d3',
  md5 = 'd41d8cd98f00b204e9800998ecf8427e',
) =>
  StateSnapshot.of({
    serial,
    lineage,
    md5,
    size: 120,
  });

const CHANGED = ChangeActor.spotlight(WorkspaceId.of('ws_1'));

const holder = {
  principal: PrincipalRef.rehydrate('token:tok_1'),
  mayForce: false,
  changedBy: CHANGED,
};

const writing = (
  lockId: string | null,
  id = 'version_1',
  written = snapshot(1),
) => ({
  id: StateVersionId.of(id),
  snapshot: written,
  lockId: lockId === null ? null : StateLockId.of(lockId),
  by: CHANGED,
  at: AT,
});

const kinds = (state: TerraformState) =>
  state.pullEvents().map((event) => event.kind);

describe('TerraformState', () => {
  it('opens with no lock and no version', () => {
    const state = opened();

    expect(state.isNew).toBe(true);
    expect(state.lock).toBeNull();
    expect(state.latest).toBeNull();
    expect(state.versions).toEqual([]);
  });

  it('takes a free lock', () => {
    expect(opened().lockAs(lock('a')).lock?.id.value).toBe('a');
  });

  it('keeps a lock the same holder takes again', () => {
    const locked = opened().lockAs(lock('a'));

    expect(locked.lockAs(lock('a'))).toBe(locked);
  });

  it('refuses a lock another holder has, and names the holder', () => {
    const locked = opened().lockAs(lock('a'));

    expect(() => locked.lockAs(lock('b'))).toThrow(TerraformStateLockedError);
    expect(() => locked.lockAs(lock('b'))).toThrow(
      expect.objectContaining({
        holder: expect.objectContaining({
          id: expect.objectContaining({ value: 'a' }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('refuses the same lock ID from another principal', () => {
    const locked = opened().lockAs(lock('a'));
    const replayed = StateLock.of({
      id: StateLockId.of('a'),
      operation: null,
      asWritten: { ID: 'a' },
      lockedBy: PrincipalRef.rehydrate('token:tok_2'),
      lockedAt: AT,
    });

    expect(() => locked.lockAs(replayed)).toThrow(TerraformStateLockedError);
  });

  it('writes without a lock ID while no lock is held', () => {
    expect(opened().write(writing(null)).version.number).toBe(1);
  });

  it('releases the lock only for its ID', () => {
    const locked = opened().lockAs(lock('a'));

    expect(() => locked.unlock(lockId('b'), holder)).toThrow(
      TerraformStateLockedError,
    );
    expect(locked.unlock(lockId('a'), holder).lock).toBeNull();
  });

  it('lets only the principal that took the lock release it, unless it may force', () => {
    const locked = opened().lockAs(lock('a'));
    const other = {
      principal: PrincipalRef.rehydrate('token:tok_2'),
      mayForce: false,
      changedBy: CHANGED,
    };

    expect(() => locked.unlock(lockId('a'), other)).toThrow(
      TerraformStateLockNotYoursError,
    );
    expect(
      locked.unlock(lockId('a'), { ...other, mayForce: true }).lock,
    ).toBeNull();
  });

  it('releases any holder’s lock when forced', () => {
    const locked = opened().lockAs(lock('a'));

    expect(locked.forceUnlock(CHANGED).lock).toBeNull();
    expect(opened().forceUnlock(CHANGED).lock).toBeNull();
  });

  it('treats releasing a free lock as done', () => {
    const state = opened();

    expect(state.unlock(lockId('a'), holder)).toBe(state);
  });

  it('writes the first version as number 1, and the next as 2', () => {
    const first = opened().write(writing(null, 'version_1'));
    const second = first.state.write(writing(null, 'version_2'));

    expect(first.version.number).toBe(1);
    expect(second.state.latest?.number).toBe(2);
    expect(second.version.id.value).toBe('version_2');
    expect(second.state.versions.map((each) => each.number)).toEqual([1, 2]);
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

    expect(state.lock?.id.value).toBe('a');
  });

  it('refuses a write that names a lock no one holds any more', () => {
    const released = opened().lockAs(lock('a')).forceUnlock(CHANGED);

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
        versions: [],
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('refuses a write from another lineage', () => {
    const { state } = opened().write(writing(null));

    expect(() =>
      state.write(writing(null, 'version_2', snapshot(2, 'other'))),
    ).toThrow(TerraformStateLineageMismatchError);
  });

  it('refuses a write behind the latest serial, and takes the same serial again', () => {
    const { state } = opened().write(writing(null, 'version_1', snapshot(5)));

    expect(() => state.write(writing(null, 'version_2', snapshot(4)))).toThrow(
      TerraformStateSerialBehindError,
    );
    expect(
      state.write(writing(null, 'version_2', snapshot(5))).version.number,
    ).toBe(2);
  });

  it('records the first write as created and later ones as updated', () => {
    const first = opened().write(writing(null)).state;
    const firstChange = first.pullEvents()[0] as unknown as {
      change: { action: string; resource: string; key: string };
    };
    const second = first.write(writing(null, 'version_2')).state;
    const secondChange = second.pullEvents()[0] as unknown as {
      change: { action: string; recordedDetail: Record<string, unknown> };
    };

    expect(firstChange.change).toMatchObject({
      action: 'created',
      resource: 'terraform-state',
      key: 'default',
    });
    expect(secondChange.change.action).toBe('updated');
    expect(secondChange.change.recordedDetail).toEqual({
      version: 2,
      serial: 1,
      lineage: 'b0a1c2d3',
    });
  });

  it('records a forced unlock and a release of another principal’s lock, but not the holder’s own release', () => {
    const locked = opened().lockAs(lock('a'));
    locked.pullEvents();

    expect(kinds(locked.unlock(lockId('a'), holder))).toEqual([]);
    expect(kinds(locked.forceUnlock(CHANGED))).toEqual([
      'terraform-state.lock-released',
    ]);
    expect(
      kinds(
        locked.unlock(lockId('a'), {
          principal: PrincipalRef.rehydrate('token:tok_2'),
          mayForce: true,
          changedBy: CHANGED,
        }),
      ),
    ).toEqual(['terraform-state.lock-released']);
  });

  it('keeps the latest 100 versions', () => {
    let state = opened();

    for (let at = 1; at <= 101; at += 1) {
      state = state.write(writing(null, `version_${at}`)).state;
    }

    const written = state.pullEvents().slice(-1)[0] as TerraformStateWritten;

    expect(state.versions).toHaveLength(100);
    expect(state.versions[0]?.number).toBe(2);
    expect(written.dropped.map((each) => each.value)).toEqual(['version_1']);
    expect(
      (
        opened()
          .write(writing(null))
          .state.pullEvents()[0] as TerraformStateWritten
      ).dropped,
    ).toEqual([]);
  });

  it('is deleted with its workspace once, as a deletion of the resource', () => {
    const { state } = opened().write(writing(null));
    state.pullEvents();

    const deleted = state.deleteWithWorkspace(CHANGED);

    expect(deleted.isDeleted).toBe(true);
    expect(kinds(deleted)).toEqual(['terraform-state.deleted']);
    expect(deleted.deleteWithWorkspace(CHANGED)).toBe(deleted);
  });

  it('refuses other content at the same serial, as another run wrote it', () => {
    const { state } = opened().write(writing(null, 'version_1', snapshot(5)));

    expect(() =>
      state.write(
        writing(
          null,
          'version_2',
          snapshot(5, 'b0a1c2d3', 'ffffffffffffffffffffffffffffffff'),
        ),
      ),
    ).toThrow(TerraformStateDivergedError);
  });
});
