import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { WarmShape } from '@work/domain/value-objects/warm-shape.vo';

const BACK_OFF_MS = 15 * 60_000;

export interface KeptWarmSandbox {
  readonly id: string;
  readonly lineId: LineId;
  readonly shape: WarmShape;
}

export interface WarmCheckout {
  readonly path: string;
  readonly setup: string | null;
}

export interface WarmSandboxRequest {
  readonly line: LineMap;
  readonly shape: WarmShape;
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

const keepsWarmSandboxes = (line: LineMap): boolean => {
  const paths = warmCheckoutsOf(line).map((each) => each.path);

  return (
    !line.warmSandboxes.isNone &&
    paths.length > 0 &&
    new Set(paths).size === paths.length
  );
};

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
      const shape = WarmShape.ofLine(line);
      const ofLine = input.kept.filter((each) => each.lineId.equals(line.id));
      const current = ofLine.filter((each) => each.shape.equals(shape));
      const wanted = line.warmSandboxes.value;
      const missing = wanted - current.length;
      const backingOff = input.lostRecently.some((each) =>
        each.equals(line.id),
      );

      retired.push(
        ...ofLine
          .filter((each) => !each.shape.equals(shape))
          .map((each) => each.id),
        ...current.slice(wanted).map((each) => each.id),
      );

      if (missing > 0 && !backingOff) {
        requested.push(
          ...Array.from({ length: missing }, () => ({ line, shape })),
        );
      }
    }

    return { requested, retired };
  },
};
