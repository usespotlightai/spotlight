import { ChevronDown, Workflow } from 'lucide-react';
import { NavLink, useMatch } from 'react-router';
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
  teamPath,
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
      <div
        data-slot="team-row"
        data-active={active || undefined}
        className="group/team flex h-7 items-center rounded-md pr-2 transition-colors hover:bg-accent"
      >
        <NavLink
          to={teamPath(slug, team.id)}
          onClick={(event) => {
            if (expanded) {
              event.preventDefault();
            }
            onToggle();
          }}
          className={cn(
            'flex h-full min-w-0 flex-1 items-center gap-2 pl-2 text-sm outline-none',
            active ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          <InitialAvatar name={team.name} className="bg-muted" />
          <span className="truncate">{team.name}</span>
        </NavLink>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={
            expanded ? `Collapse ${team.name}` : `Expand ${team.name}`
          }
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-opacity hover:text-foreground',
            'opacity-0 group-hover/team:opacity-100 focus-visible:opacity-100',
            expanded && 'opacity-100',
          )}
        >
          <ChevronDown
            className={cn(
              'size-3 transition-transform',
              !expanded && '-rotate-90',
            )}
            aria-hidden
          />
        </button>
      </div>

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
