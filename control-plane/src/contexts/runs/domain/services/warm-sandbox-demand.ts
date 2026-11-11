import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import type { WarmLine } from '@runs/domain/value-objects/warm-line.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

const BACK_OFF_MS = 15 * 60_000;

export interface KeptWarmSandbox {
  readonly id: string;
  readonly lineId: LineId;
  readonly fingerprint: WarmFingerprint;
  readonly placed: boolean;
}

export interface WarmSandboxRequest {
  readonly line: WarmLine;
  readonly fingerprint: WarmFingerprint;
}

export interface WarmSandboxDemand {
  readonly requested: readonly WarmSandboxRequest[];
  readonly retired: readonly string[];
}

const keepsWarmSandboxes = (line: WarmLine): boolean =>
  line.warmSandboxes > 0 && line.checkouts.length > 0;

export const WarmSandboxDemands = {
  lostAfter(now: Date): Date {
    return new Date(now.getTime() - BACK_OFF_MS);
  },

  of(input: {
    lines: readonly WarmLine[];
    kept: readonly KeptWarmSandbox[];
    lostRecently: readonly LineId[];
  }): WarmSandboxDemand {
    const lines = input.lines.filter(keepsWarmSandboxes);
    const requested: WarmSandboxRequest[] = [];
    const retired = input.kept
      .filter((each) => !lines.some((line) => line.id.equals(each.lineId)))
      .map((each) => each.id);

    for (const line of lines) {
      const fingerprint = WarmFingerprint.ofSetup(line);
      const ofLine = input.kept.filter((each) => each.lineId.equals(line.id));
      const current = ofLine
        .filter((each) => each.fingerprint.equals(fingerprint))
        .sort((a, b) => Number(b.placed) - Number(a.placed));
      const wanted = line.warmSandboxes;
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
