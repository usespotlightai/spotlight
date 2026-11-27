import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { AgentChats } from '@/components/features/agent/AgentChats';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { FileDropZone } from '@/components/shared/attachment/FileDropZone';

export function Agent(): ReactElement | null {
  const { slug, teamId } = useParams();

  if (
    slug === undefined ||
    slug === '' ||
    teamId === undefined ||
    teamId === ''
  ) {
    return null;
  }

  return (
    <FileDropZone className="flex min-h-0 flex-1 flex-col rounded-lg">
      <TeamSectionPage section="agent">
        <AgentChats slug={slug} teamId={teamId} />
      </TeamSectionPage>
    </FileDropZone>
  );
}
