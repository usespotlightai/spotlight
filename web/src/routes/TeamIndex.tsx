import { Navigate, useParams } from 'react-router';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import {
  assemblyLinePath,
  FALLBACK_TEAM_SECTION_ID,
  teamSectionPath,
} from '@/lib/team';

export function TeamIndex() {
  const { slug, teamId } = useParams();
  const { data: lines, isPending } = useAssemblyLines(teamId);

  if (!slug || !teamId || isPending) {
    return null;
  }

  const [first] = lines ?? [];

  return (
    <Navigate
      replace
      to={
        first
          ? assemblyLinePath(slug, teamId, first.id)
          : teamSectionPath(slug, teamId, FALLBACK_TEAM_SECTION_ID)
      }
    />
  );
}
