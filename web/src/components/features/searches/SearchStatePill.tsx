import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import {
  endingMarkShown,
  endingShown,
  type SearchEnding,
} from '@/lib/search-words';

export function SearchStatePill({ ending }: { ending: SearchEnding | null }) {
  const mark = endingMarkShown(ending);

  if (!ending || !mark) {
    return null;
  }

  return (
    <Noted note={`${endingShown(ending)}.`}>
      <span className="flex">
        <Pill>{mark}</Pill>
      </span>
    </Noted>
  );
}
