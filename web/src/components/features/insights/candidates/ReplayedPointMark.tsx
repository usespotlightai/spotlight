import {
  FRONTIER_INK,
  REPLAYED_INK,
} from '@/components/features/insights/candidates/replayed-ink';
import { type MarkShape, ScatterMark } from '@/components/shared/ScatterMark';
import type { ReplayedMark, ReplayedPoint } from '@/lib/insights-candidates';

const SHAPES: Record<ReplayedMark, MarkShape> = {
  baseline: 'diamond',
  searched: 'circle',
};

export type ReplayedPointMarkProps = {
  cx?: number;
  cy?: number;
  payload?: ReplayedPoint;
  hollow?: boolean;
};

export function ReplayedPointMark({
  cx,
  cy,
  payload,
  hollow = false,
}: ReplayedPointMarkProps) {
  if (!payload) {
    return null;
  }

  return (
    <ScatterMark
      cx={cx}
      cy={cy}
      shape={SHAPES[payload.mark]}
      hollow={hollow}
      fill={
        payload.frontier && !hollow && payload.mark !== 'baseline'
          ? FRONTIER_INK.fill
          : REPLAYED_INK[payload.mark].fill
      }
    />
  );
}
