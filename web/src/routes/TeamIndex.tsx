import { Navigate, useParams } from 'react-router';
import { useLines } from '@/hooks/api/useLines';
import {
  FALLBACK_TEAM_SECTION_ID,
  linePath,
  teamSectionPath,
} from '@/lib/team';

export function TeamIndex() {
  const { slug, teamId } = useParams();
  const { data: lines, isPending } = useLines(teamId);

  if (!slug || !teamId || isPending) {
    return null;
  }

  const [first] = lines ?? [];

  return (
    <Navigate
      replace
      to={
        first
          ? linePath(slug, teamId, first.id)
          : teamSectionPath(slug, teamId, FALLBACK_TEAM_SECTION_ID)
      }
    />
  );
}
