import { SidebarHeading } from '@/components/shell/layout/SidebarHeading';
import { TeamNavItem } from '@/components/shell/layout/TeamNavItem';
import { useCollapsed } from '@/hooks/useCollapsed';
import type { Team } from '@/lib/team';

const TEAMS_STORAGE_KEY = 'spotlight.collapsed-teams';

type TeamNavProps = {
  slug: string;
  teams: readonly Team[];
};

export function TeamNav({ slug, teams }: TeamNavProps) {
  const { isExpanded, toggle } = useCollapsed(TEAMS_STORAGE_KEY);

  return (
    <section>
      <SidebarHeading>Your teams</SidebarHeading>

      <ul className="flex flex-col gap-0.5">
        {teams.map((team) => (
          <TeamNavItem
            key={team.id}
            slug={slug}
            team={team}
            expanded={isExpanded(team.id)}
            onToggle={() => toggle(team.id)}
          />
        ))}
      </ul>
    </section>
  );
}
