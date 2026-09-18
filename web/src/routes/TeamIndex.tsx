import { Navigate, useParams } from 'react-router';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useLines } from '@/hooks/api/useLines';
import { failed, loading } from '@/lib/query';
import {
  FALLBACK_TEAM_SECTION_ID,
  linePath,
  teamSectionPath,
} from '@/lib/team';

export function TeamIndex() {
  const { slug, teamId } = useParams();
  const lines = useLines(teamId);

  if (!slug || !teamId) {
    return null;
  }

  if (failed(lines)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The lines"
          retrying={lines.isFetching}
          onRetry={() => void lines.refetch()}
        />
      </PageNotice>
    );
  }

  if (loading(lines)) {
    return (
      <div
        role="status"
        aria-label="Loading the team"
        className="flex min-h-0 flex-1 flex-col"
      >
        <PageHeader />
      </div>
    );
  }

  const [first] = lines.data ?? [];

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
