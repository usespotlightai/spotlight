import { ChevronRight } from 'lucide-react';
import { Navigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import {
  DEFAULT_TEAM_SECTION_ID,
  findTeamSection,
  teamSectionPath,
} from '@/lib/team';

export function TeamSection() {
  const { slug, teamId, section } = useParams();
  const { data: workspace } = useWorkspace(slug);

  if (!slug || !teamId) {
    return null;
  }

  const meta = findTeamSection(section);

  if (!meta) {
    return (
      <Navigate
        to={teamSectionPath(slug, teamId, DEFAULT_TEAM_SECTION_ID)}
        replace
      />
    );
  }

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);
  const Icon = meta.icon;

  return (
    <>
      <PageHeader
        title={
          team ? (
            <>
              <span className="truncate">{team.name}</span>
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">{meta.label}</span>
            </>
          ) : (
            meta.label
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
        <div className="flex size-9 items-center justify-center rounded-lg border-1 border-border bg-background">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground text-sm">{meta.label}</p>
        <p className="max-w-xs text-center text-muted-foreground text-sm">
          Nothing here yet.
        </p>
      </div>
    </>
  );
}
