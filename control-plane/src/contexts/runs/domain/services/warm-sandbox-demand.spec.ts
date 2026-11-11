import {
  type KeptWarmSandbox,
  WarmSandboxDemands,
} from '@runs/domain/services/warm-sandbox-demand';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import {
  checkoutOf,
  warmLineOf,
} from '@runs/domain/value-objects/warm-line.fake-spec';
import type { WarmLine } from '@runs/domain/value-objects/warm-line.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-08T12:00:00.000Z');

const keptOf = (
  id: string,
  line: WarmLine,
  fingerprint = WarmFingerprint.ofSetup(line),
  placed = true,
): KeptWarmSandbox => ({ id, lineId: line.id, fingerprint, placed });

const demandOf = (
  lines: readonly WarmLine[],
  kept: readonly KeptWarmSandbox[] = [],
  lostRecently: readonly LineId[] = [],
) => WarmSandboxDemands.of({ lines, kept, lostRecently });

describe('WarmSandboxDemands', () => {
  it('requests the warm sandboxes a line is missing, with the line’s current fingerprint', () => {
    const line = warmLineOf({ warm: 3 });

    const demand = demandOf([line], [keptOf('sandbox_1', line)]);

    expect(demand.retired).toEqual([]);
    expect(demand.requested).toEqual([
      { line, fingerprint: WarmFingerprint.ofSetup(line) },
      { line, fingerprint: WarmFingerprint.ofSetup(line) },
    ]);
  });

  it('keeps a line’s warm sandboxes as they are when it has as many as it asks for', () => {
    const line = warmLineOf({ warm: 2 });

    expect(
      demandOf([line], [keptOf('sandbox_1', line), keptOf('sandbox_2', line)]),
    ).toEqual({ requested: [], retired: [] });
  });

  it('retires the extra warm sandboxes, keeping the oldest', () => {
    const line = warmLineOf({ warm: 1 });

    expect(
      demandOf([line], [keptOf('sandbox_1', line), keptOf('sandbox_2', line)])
        .retired,
    ).toEqual(['sandbox_2']);
  });

  it('retires the extra warm sandboxes no host started before the ones a host started', () => {
    const line = warmLineOf({ warm: 1 });

    expect(
      demandOf(
        [line],
        [
          keptOf('sandbox_1', line, WarmFingerprint.ofSetup(line), false),
          keptOf('sandbox_2', line),
        ],
      ).retired,
    ).toEqual(['sandbox_1']);
  });

  it('replaces a warm sandbox whose line changed its repositories, setups, image or placement', () => {
    const line = warmLineOf();
    const before = WarmFingerprint.ofSetup(
      warmLineOf({ checkouts: [checkoutOf('widgets')] }),
    );

    expect(demandOf([line], [keptOf('sandbox_1', line, before)])).toEqual({
      requested: [{ line, fingerprint: WarmFingerprint.ofSetup(line) }],
      retired: ['sandbox_1'],
    });
    expect(
      WarmFingerprint.ofSetup(
        warmLineOf({ placement: RunnerPlacement.of(['gpu']) }),
      ).equals(WarmFingerprint.ofSetup(line)),
    ).toBe(false);
    expect(
      WarmFingerprint.ofSetup(
        warmLineOf({
          placement: RunnerPlacement.anywhere().in(
            RunnerImage.of('ghcr.io/acme/node:22'),
          ),
        }),
      ).equals(WarmFingerprint.ofSetup(line)),
    ).toBe(false);
  });

  it('retires every warm sandbox of a line that asks for none or is gone', () => {
    const none = warmLineOf({ id: 'line_1', warm: 0 });
    const gone = warmLineOf({ id: 'line_2' });

    expect(
      demandOf([none], [keptOf('sandbox_1', none), keptOf('sandbox_2', gone)]),
    ).toEqual({ requested: [], retired: ['sandbox_1', 'sandbox_2'] });
  });

  it('requests none for a line that lost a warm sandbox unadopted within the back-off', () => {
    const line = warmLineOf({ warm: 2 });

    expect(demandOf([line], [], [line.id]).requested).toEqual([]);
    expect(WarmSandboxDemands.lostAfter(NOW)).toEqual(
      new Date(NOW.getTime() - 15 * 60_000),
    );
  });

  it('keeps none for a line with no repositories', () => {
    expect(demandOf([warmLineOf({ checkouts: [] })]).requested).toEqual([]);
  });
});
