import { useParams, useSearchParams } from 'react-router';
import { MemoryFilterMenu } from '@/components/features/memory/MemoryFilterMenu';
import { TeamMemory } from '@/components/features/memory/TeamMemory';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { FOCUS_PARAM } from '@/lib/memory';

export function Memory() {
  const { slug, teamId } = useParams();
  const [params] = useSearchParams();

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TeamSectionPage
      section="memory"
      actions={
        <>
          {!params.has(FOCUS_PARAM) && <MemoryFilterMenu teamId={teamId} />}
          <WriteMemoryButton teamId={teamId} />
        </>
      }
    >
      <TeamMemory slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
