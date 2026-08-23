import { ChevronDown } from 'lucide-react';
import { NavLink, useMatch } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { SidebarLink } from '@/components/layout/SidebarLink';
import {
  TEAM_SECTIONS,
  type Team,
  teamPath,
  teamSectionPath,
} from '@/lib/team';
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

      {/* Animates to a height nobody measured: the grid row goes 0fr to 1fr.
          The sections stay mounted so they can animate, so `inert` is what
          keeps a closed team out of the tab order. */}
      <div
        data-slot="team-sections"
        data-open={expanded || undefined}
        className={cn(
          'grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <ul
          inert={!expanded}
          className="flex min-h-0 flex-col gap-0.5 overflow-hidden pt-0.5"
        >
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
        </ul>
      </div>
    </li>
  );
}
