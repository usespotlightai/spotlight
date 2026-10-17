import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import {
  formatEnding,
  formatEndingMark,
  type SearchEnding,
} from '@/lib/search-words';

export function SearchStatePill({ ending }: { ending: SearchEnding | null }) {
  const mark = formatEndingMark(ending);

  if (!ending || !mark) {
    return null;
  }

  return (
    <Noted note={`${formatEnding(ending)}.`}>
      <span className="flex">
        <Pill>{mark}</Pill>
      </span>
    </Noted>
  );
}
