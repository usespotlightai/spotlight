import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import type { Adoption } from '@/lib/insights-candidates';
import { dayShown } from '@/lib/judge';

const adoptedNote = (day: string, adoption: Adoption): string => {
  if (adoption.live) {
    return `Adopted on ${day}. Live now.`;
  }

  return adoption.creditedTo
    ? `Adopted on ${day}, later credited to ${adoption.creditedTo.name}${adoption.creditedTo.withdrawn ? ' (withdrawn)' : ''}.`
    : `Adopted on ${day}, since replaced.`;
};

export function AdoptedPill({ adoption }: { adoption: Adoption }) {
  const day = dayShown(adoption.at.slice(0, 10));

  return (
    <Noted note={adoptedNote(day, adoption)}>
      <span className="inline-flex">
        <Pill className="gap-1 py-0 pr-1.5 pl-1.5 text-[0.7rem] text-foreground">
          Adopted
        </Pill>
      </span>
    </Noted>
  );
}
