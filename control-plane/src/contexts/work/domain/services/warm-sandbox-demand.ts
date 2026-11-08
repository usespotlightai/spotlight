import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { WarmFingerprint } from '@work/domain/value-objects/warm-fingerprint.vo';

const BACK_OFF_MS = 15 * 60_000;

export interface KeptWarmSandbox {
  readonly id: string;
  readonly lineId: LineId;
  readonly fingerprint: WarmFingerprint;
  readonly placed: boolean;
}

export interface WarmCheckout {
  readonly path: string;
  readonly setup: string | null;
}

export interface WarmSandboxRequest {
  readonly line: LineMap;
  readonly fingerprint: WarmFingerprint;
}

export interface WarmSandboxDemand {
  readonly requested: readonly WarmSandboxRequest[];
  readonly retired: readonly string[];
}

export const warmCheckoutsOf = (line: LineMap): readonly WarmCheckout[] =>
  line.repositories.entries.map((each) => ({
    path: each.repository.name,
    setup: each.setup,
  }));

const keepsWarmSandboxes = (line: LineMap): boolean =>
  !line.warmSandboxes.isNone && !line.repositories.isEmpty;

export const WarmSandboxDemands = {
  lostAfter(now: Date): Date {
    return new Date(now.getTime() - BACK_OFF_MS);
  },

  of(input: {
    lines: readonly LineMap[];
    kept: readonly KeptWarmSandbox[];
    lostRecently: readonly LineId[];
  }): WarmSandboxDemand {
    const lines = input.lines.filter(keepsWarmSandboxes);
    const requested: WarmSandboxRequest[] = [];
    const retired = input.kept
      .filter((each) => !lines.some((line) => line.id.equals(each.lineId)))
      .map((each) => each.id);

    for (const line of lines) {
      const fingerprint = WarmFingerprint.ofLine(line);
      const ofLine = input.kept.filter((each) => each.lineId.equals(line.id));
      const current = ofLine
        .filter((each) => each.fingerprint.equals(fingerprint))
        .sort((a, b) => Number(b.placed) - Number(a.placed));
      const wanted = line.warmSandboxes.value;
      const missing = wanted - current.length;
      const backingOff = input.lostRecently.some((each) =>
        each.equals(line.id),
      );

      retired.push(
        ...ofLine
          .filter((each) => !each.fingerprint.equals(fingerprint))
          .map((each) => each.id),
        ...current.slice(wanted).map((each) => each.id),
      );

      if (missing > 0 && !backingOff) {
        requested.push(
          ...Array.from({ length: missing }, () => ({ line, fingerprint })),
        );
      }
    }

    return { requested, retired };
  },
};
