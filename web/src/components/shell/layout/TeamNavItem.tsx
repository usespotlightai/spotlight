import { ChevronDown } from 'lucide-react';
import { useMatch } from 'react-router';
import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { TeamLines } from '@/components/shell/layout/TeamLines';
import { TeamSectionLink } from '@/components/shell/layout/TeamSectionLink';
import { useLines } from '@/hooks/api/useLines';
import { useTasks } from '@/hooks/api/useTasks';
import type { Team } from '@/lib/team';
import { cn } from '@/lib/utils';

type TeamNavItemProps = {
  slug: string;
  team: Team;
  expanded: boolean;
  onToggle: () => void;
};

export function TeamNavItem({
  slug,
  team,
  expanded,
  onToggle,
}: TeamNavItemProps) {
  const active = Boolean(useMatch(`/w/${slug}/team/${team.id}/*`));
  const { data: lines } = useLines(team.id, expanded);

  const atTask = useMatch(`/w/${slug}/team/${team.id}/tasks/:taskId/*`);
  const { data: tasks } = useTasks(atTask ? team.id : undefined);

  const viewedTask = tasks?.find((each) => each.id === atTask?.params.taskId);
  const shownLine = lines?.find((line) =>
    line.stations.some((station) => station.id === viewedTask?.stationId),
  );

  return (
    <li>
      <button
        type="button"
        data-slot="team-row"
        data-active={active || undefined}
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'group/team flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors hover:bg-border/50',
          active ? 'font-medium text-foreground' : 'text-muted-foreground',
        )}
      >
        <InitialAvatar name={team.name} className="bg-muted" />
        <span className="truncate">{team.name}</span>

        <ChevronDown
          className={cn(
            'ml-auto size-3 shrink-0 transition-all',
            expanded
              ? 'opacity-100'
              : '-rotate-90 opacity-0 group-hover/team:opacity-100 group-focus-visible/team:opacity-100',
          )}
          aria-hidden
        />
      </button>

      <Disclosure open={expanded} slot="team-sections">
        <TeamSectionLink slug={slug} teamId={team.id} section="agent" />

        <TeamLines
          slug={slug}
          teamId={team.id}
          lines={lines}
          shownLineId={shownLine?.id}
        />

        <TeamSectionLink slug={slug} teamId={team.id} section="runs" />
        <TeamSectionLink slug={slug} teamId={team.id} section="insights" />
        <TeamSectionLink slug={slug} teamId={team.id} section="memory" />
      </Disclosure>
    </li>
  );
}
