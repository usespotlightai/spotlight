import { ChevronDown, Package, Settings } from 'lucide-react';
import { useMatch } from 'react-router';
import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { SidebarGroup } from '@/components/shell/layout/SidebarGroup';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { TeamSectionLink } from '@/components/shell/layout/TeamSectionLink';
import { useLines } from '@/hooks/api/useLines';
import { useTasks } from '@/hooks/api/useTasks';
import { useCollapsed } from '@/hooks/useCollapsed';
import {
  linePath,
  SECTIONS_ABOVE_LINES,
  SECTIONS_BELOW_LINES,
  SETTINGS_PAGES,
  settingsPath,
  type Team,
} from '@/lib/team';
import { cn } from '@/lib/utils';

const LINE_GROUPS_STORAGE_KEY = 'spotlight.collapsed-line-groups';
const SETTINGS_GROUPS_STORAGE_KEY = 'spotlight.collapsed-settings-groups';

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
  const lineGroups = useCollapsed(LINE_GROUPS_STORAGE_KEY);
  const settingsGroups = useCollapsed(SETTINGS_GROUPS_STORAGE_KEY);

  const atTask = useMatch(`/w/${slug}/team/${team.id}/tasks/:taskId`);
  const atTrace = useMatch(
    `/w/${slug}/team/${team.id}/observability/tasks/:taskId`,
  );
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
        {SECTIONS_ABOVE_LINES.map((section) => (
          <TeamSectionLink
            key={section.id}
            slug={slug}
            teamId={team.id}
            section={section}
          />
        ))}

        <SidebarGroup
          label="Lines"
          icon={Package}
          slot="lines"
          open={lineGroups.isExpanded(team.id)}
          onToggle={() => lineGroups.toggle(team.id)}
        >
          {lines?.map((line) => (
            <li key={line.id}>
              <SidebarLink
                to={linePath(slug, team.id, line.id)}
                className="pl-14"
                active={line.id === shownLine?.id}
              >
                {line.name}
              </SidebarLink>
            </li>
          ))}
        </SidebarGroup>

        {SECTIONS_BELOW_LINES.map((section) => (
          <TeamSectionLink
            key={section.id}
            slug={slug}
            teamId={team.id}
            section={section}
            active={section.id === 'observability' && Boolean(atTrace)}
          />
        ))}

        <SidebarGroup
          label="Settings"
          icon={Settings}
          slot="settings"
          open={settingsGroups.isExpanded(team.id)}
          onToggle={() => settingsGroups.toggle(team.id)}
        >
          {SETTINGS_PAGES.map((page) => (
            <li key={page.id}>
              <SidebarLink
                to={settingsPath(slug, team.id, page.id)}
                className="pl-14"
              >
                {page.label}
              </SidebarLink>
            </li>
          ))}
        </SidebarGroup>
      </Disclosure>
    </li>
  );
}
