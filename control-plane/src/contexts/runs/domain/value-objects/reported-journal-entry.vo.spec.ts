import { InvalidJournalEntryError } from '@runs/domain/exceptions/invalid-journal-entry.error';
import {
  HOOK_CALLED,
  PROVISION_FAILED,
  RUN_PAUSED,
} from '@runs/domain/value-objects/journal-entry-type';
import { JournalSeq } from '@runs/domain/value-objects/journal-seq.vo';
import { ReportedJournalEntry } from '@runs/domain/value-objects/reported-journal-entry.vo';
import { describe, expect, it } from 'vitest';

const AT = '2026-11-07T10:00:00.000Z';

describe('ReportedJournalEntry', () => {
  it('takes a runner entry at a runner place', () => {
    const entry = ReportedJournalEntry.of({ seq: 1, type: 'output', at: AT });

    expect(entry.seq.value).toBe(1);
    expect(entry.at).toEqual(new Date(AT));
  });

  it('refuses a runner entry at a control-plane place', () => {
    for (const seq of [0, -1, JournalSeq.firstControlPlane, 1.5]) {
      expect(() =>
        ReportedJournalEntry.of({ seq, type: 'output', at: AT }),
      ).toThrow(InvalidJournalEntryError);
    }
  });

  it('refuses entry types that only the control plane writes', () => {
    for (const type of [RUN_PAUSED, HOOK_CALLED, PROVISION_FAILED]) {
      expect(() => ReportedJournalEntry.of({ seq: 3, type, at: AT })).toThrow(
        InvalidJournalEntryError,
      );
    }
  });

  it('refuses a time that is not a time', () => {
    expect(() =>
      ReportedJournalEntry.of({ seq: 3, type: 'output', at: 'soon' }),
    ).toThrow(InvalidJournalEntryError);
  });
});

describe('JournalSeq', () => {
  it('places control-plane entries below the lowest one', () => {
    expect(JournalSeq.controlPlaneBelow(null).value).toBe(
      JournalSeq.firstControlPlane,
    );
    expect(
      JournalSeq.controlPlaneBelow(JournalSeq.firstControlPlane - 2).value,
    ).toBe(JournalSeq.firstControlPlane - 3);
    expect(JournalSeq.isControlPlane(JournalSeq.firstControlPlane)).toBe(true);
    expect(JournalSeq.isControlPlane(-999_999)).toBe(false);
  });
});
