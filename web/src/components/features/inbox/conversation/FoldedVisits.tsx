import { FoldedVisitRow } from '@/components/features/inbox/conversation/FoldedVisitRow';
import type { ConversationItem, FoldedVisit, RunJournal } from '@/lib/inbox';

type FoldedVisitsProps = {
  visits: readonly FoldedVisit[];
  item: ConversationItem;
  worked: readonly RunJournal[];
};

export function FoldedVisits({ visits, item, worked }: FoldedVisitsProps) {
  return (
    <div
      aria-label="Other station visits"
      role="group"
      className="flex flex-col gap-0.5"
    >
      {visits.map((visit) => (
        <FoldedVisitRow
          key={visit.notes[0]?.position}
          visit={visit}
          stationCount={item.station.count}
          teamId={item.teamId}
          about={item.about}
          worked={worked}
        />
      ))}
    </div>
  );
}
