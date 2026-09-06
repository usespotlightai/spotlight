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
      <div className="flex h-7 items-center px-2">
        <h2 className="font-medium text-muted-foreground text-xs">
          Your teams
        </h2>
      </div>

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
