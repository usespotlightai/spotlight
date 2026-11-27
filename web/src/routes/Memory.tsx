import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { MemoryFilterMenu } from '@/components/features/memory/MemoryFilterMenu';
import { TeamMemory } from '@/components/features/memory/TeamMemory';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { nonEmpty } from '@/lib/non-empty';

export function Memory(): ReactElement | null {
  const { slug, teamId } = useParams();

  if (!nonEmpty(slug) || !nonEmpty(teamId)) {
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
