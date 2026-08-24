import { ChevronDown, Workflow } from 'lucide-react';
import { useMatch } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Disclosure } from '@/components/layout/Disclosure';
import { DisclosureRow } from '@/components/layout/DisclosureRow';
import { SidebarLink } from '@/components/layout/SidebarLink';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
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
            icon={Workflow}
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
            >
              {section.label}
            </SidebarLink>
          </li>
        ))}
      </Disclosure>
    </li>
  );
}
