import { ChevronDown, Package } from 'lucide-react';
import { useMatch } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Disclosure } from '@/components/layout/Disclosure';
import { DisclosureRow } from '@/components/layout/DisclosureRow';
import { SidebarLink } from '@/components/layout/SidebarLink';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useTasks } from '@/hooks/api/useTasks';
import { useCollapsed } from '@/hooks/useCollapsed';
import {
  assemblyLinePath,
  TEAM_SECTIONS,
  type Team,
  teamSectionPath,
} from '@/lib/team';
import { cn } from '@/lib/utils';

const LINE_GROUPS_STORAGE_KEY = 'spotlight.collapsed-line-groups';

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
  const { data: lines } = useAssemblyLines(team.id, expanded);
  const groups = useCollapsed(LINE_GROUPS_STORAGE_KEY);
  const linesOpen = groups.isExpanded(team.id);

  // A task is addressed under its team, not under the line it stands in, so
  // the line it is in does not light up on its own. Its trace is addressed
  // under observability, which is what leads to it.
  const atTask = useMatch(`/w/${slug}/team/${team.id}/tasks/:taskId`);
  const atTrace = useMatch(
    `/w/${slug}/team/${team.id}/observability/tasks/:taskId`,
  );
  // Only while a task is being read: the page reading it asks for the same
  // tasks, so this costs nothing there and nothing anywhere else.
  const { data: tasks } = useTasks(atTask ? team.id : undefined);

  const standing = tasks?.find((each) => each.id === atTask?.params.taskId);
  const shownLine = lines?.find((line) =>
    line.stations.some((station) => station.id === standing?.stationId),
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
          'group/team flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors hover:bg-accent',
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
        <li>
          <DisclosureRow
            label="Assembly lines"
            icon={Package}
            open={linesOpen}
            onToggle={() => groups.toggle(team.id)}
            className="pl-8"
          />

          <Disclosure open={linesOpen} slot="assembly-lines">
            {lines?.map((line) => (
              <li key={line.id}>
                <SidebarLink
                  to={assemblyLinePath(slug, team.id, line.id)}
                  className="pl-14"
                  active={line.id === shownLine?.id}
                >
                  {line.name}
                </SidebarLink>
              </li>
            ))}
          </Disclosure>
        </li>

        {TEAM_SECTIONS.map((section) => (
          <li key={section.id}>
            <SidebarLink
              to={teamSectionPath(slug, team.id, section.id)}
              icon={section.icon}
              className="pl-8"
              active={section.id === 'observability' && Boolean(atTrace)}
            >
              {section.label}
            </SidebarLink>
          </li>
        ))}
      </Disclosure>
    </li>
  );
}
