import { useParams } from 'react-router';
import { MemoryFilterMenu } from '@/components/features/memory/MemoryFilterMenu';
import { TeamMemory } from '@/components/features/memory/TeamMemory';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';

export function Memory() {
  const { slug, teamId } = useParams();

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TeamSectionPage
      section="memory"
      bordered={false}
      actions={
        <>
          <MemoryFilterMenu teamId={teamId} />
          <WriteMemoryButton />
        </>
      }
    >
      <TeamMemory slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
