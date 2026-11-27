import { useParams } from 'react-router';

import { MemoryUpkeepReview } from '@/components/features/memory/upkeep/MemoryUpkeepReview';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { nonEmpty } from '@/lib/non-empty';

export function MemoryUpkeep() {
  const { slug, teamId, upkeepId } = useParams();

  if (!nonEmpty(slug) || !nonEmpty(teamId) || !nonEmpty(upkeepId)) {
    return null;
  }

  return (
    <TeamSectionPage section="memory" crumbs={[{ label: 'Upkeep' }]}>
      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-6 @xl/pane:px-8 @xl/pane:py-8">
          <MemoryUpkeepReview slug={slug} teamId={teamId} upkeepId={upkeepId} />
        </div>
      </ScrollArea>
    </TeamSectionPage>
  );
}
