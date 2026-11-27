import type { ReactElement } from 'react';

import { FoldedVisitRow } from '@/components/features/inbox/conversation/FoldedVisitRow';
import type { ConversationItem, FoldedVisit, RunJournal } from '@/lib/inbox';

type FoldedVisitsProps = {
  visits: readonly FoldedVisit[];
  item: ConversationItem;
  worked: readonly RunJournal[];
};

export function FoldedVisits({
  visits,
  item,
  worked,
}: FoldedVisitsProps): ReactElement {
  return (
    <div
      aria-label="Other station visits"
      role="group"
      className="flex flex-col gap-0.5"
    >
      {visits.map((visit) => (
        <FoldedVisitRow
          key={visit.first.position}
          visit={visit}
          item={item}
          worked={worked}
        />
      ))}
    </div>
  );
}
