import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ArchiveFacts } from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  anArchive,
  aSealedArchive,
  later,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { WorkspaceArchiveNotUploadedError } from '@work/domain/exceptions/workspace-archive-not-uploaded.error';
import type { HolderState } from '@work/domain/value-objects/archive-holder.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const carryingOn: HolderState = {
  stationId: StationId.of('station_1'),
  conversing: true,
  finished: false,
  changedAt: later(0),
};

const held: ArchiveFacts = { holder: carryingOn, supersededAt: null };

const letGo = (part: Partial<HolderState>): ArchiveFacts => ({
  holder: { ...carryingOn, changedAt: later(2 * DAY), ...part },
  supersededAt: null,
});

describe('WorkspaceArchive', () => {
  it('is granted to one run, and waits to be sealed', () => {
    const archive = anArchive({ run: 'run_7' });

    expect(archive.grantedFor(RunId.of('run_7'))).toBe(true);
    expect(archive.grantedFor(RunId.of('run_8'))).toBe(false);
    expect(archive.isSealed).toBe(false);
  });

  it('is sealed once storage holds exactly what was granted', () => {
    const sealed = anArchive().sealed(storedAs(1_024), later(5_000));

    expect(sealed.isSealed).toBe(true);
    expect(sealed.sealedAt).toEqual(later(5_000));
  });

  it('refuses to be sealed when nothing was uploaded, or something else was', () => {
    expect(() => anArchive().sealed(null, later(0))).toThrow(
      WorkspaceArchiveNotUploadedError,
    );
    expect(() => anArchive().sealed(storedAs(2_048), later(0))).toThrow(
      WorkspaceArchiveNotUploadedError,
    );
    expect(() =>
      anArchive().sealed(storedAs(1_024, 'b'.repeat(64)), later(0)),
    ).toThrow(WorkspaceArchiveNotUploadedError);
  });

  it('stays as it was sealed when sealed again', () => {
    const sealed = aSealedArchive();

    expect(sealed.sealed(null, later(DAY))).toBe(sealed);
  });

  it('is removed a day after it was granted, if it was never sealed', () => {
    const waiting = anArchive();

    expect(waiting.removableAt(later(DAY - 1), held)).toBe(false);
    expect(waiting.removableAt(later(DAY), held)).toBe(true);
  });

  it('is kept while the task or chat it belongs to carries on', () => {
    expect(aSealedArchive().removableAt(later(365 * DAY), held)).toBe(false);
  });

  it('is removed at once when the task or chat it belongs to is gone', () => {
    expect(
      aSealedArchive().removableAt(later(1), {
        holder: null,
        supersededAt: null,
      }),
    ).toBe(true);
  });

  it('is removed an hour after a newer archive of the same work is sealed', () => {
    const facts = { ...held, supersededAt: later(DAY) };

    expect(aSealedArchive().removableAt(later(DAY + HOUR - 1), facts)).toBe(
      false,
    );
    expect(aSealedArchive().removableAt(later(DAY + HOUR), facts)).toBe(true);
  });

  it.each([
    ['finished', { finished: true }],
    ['moved to another station', { stationId: StationId.of('station_2') }],
    ['no longer in a conversation', { conversing: false }],
  ])(
    'is kept for a week after its task was %s, counted from whichever came last',
    (_, part) => {
      const facts = letGo(part);

      expect(aSealedArchive().removableAt(later(9 * DAY - 1), facts)).toBe(
        false,
      );
      expect(aSealedArchive().removableAt(later(9 * DAY), facts)).toBe(true);

      const sealedLater = anArchive().sealed(storedAs(1_024), later(3 * DAY));

      expect(sealedLater.removableAt(later(9 * DAY), facts)).toBe(false);
      expect(sealedLater.removableAt(later(10 * DAY), facts)).toBe(true);
    },
  );

  it('is discarded when removed', () => {
    expect(aSealedArchive().removed().isDiscarded).toBe(true);
  });

  it('carries the SHA-256 it was granted for', () => {
    expect(anArchive().digest.sha256).toBe(SHA256);
  });
});
