import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  formatStopReason,
  formatStopReasonMark,
  type SearchStopReason,
} from '@/lib/search-words';

export function SearchStatePill({
  stopReason,
}: {
  stopReason: SearchStopReason | null;
}) {
  const mark = formatStopReasonMark(stopReason);

  if (!stopReason || !mark) {
    return null;
  }

  return (
    <WithTooltip tooltip={`${formatStopReason(stopReason)}.`}>
      <span className="flex">
        <Pill>{mark}</Pill>
      </span>
    </WithTooltip>
  );
}
