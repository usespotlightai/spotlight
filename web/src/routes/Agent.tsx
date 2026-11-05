import { useParams } from 'react-router';
import { AgentChats } from '@/components/features/agent/AgentChats';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { FileDropZone } from '@/components/shared/attachment/FileDropZone';

export function Agent() {
  const { slug, teamId } = useParams();

  if (!slug || !teamId) {
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
