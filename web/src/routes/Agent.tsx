import { useParams } from 'react-router';
import { AgentChats } from '@/components/features/agent/AgentChats';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';

export function Agent() {
  const { slug, teamId } = useParams();

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TeamSectionPage section="agent">
      <AgentChats slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
