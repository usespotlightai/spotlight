import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
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
    <Noted note={`${formatStopReason(stopReason)}.`}>
      <span className="flex">
        <Pill>{mark}</Pill>
      </span>
    </Noted>
  );
}
