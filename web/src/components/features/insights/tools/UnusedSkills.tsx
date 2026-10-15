import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { skillPath } from '@/lib/skills';

type UnusedSkillsProps = {
  slug: string;
  teamId: string;
  unused: readonly string[];
};

export function UnusedSkills({ slug, teamId, unused }: UnusedSkillsProps) {
  return (
    <InsightsCard
      title="Unused skills"
      description="Team skills that no run read in this period."
    >
      <ul aria-label="Unused skills" className="flex flex-wrap gap-1.5">
        {unused.map((key) => (
          <li key={key}>
            <TrailLink
              to={skillPath(slug, teamId, key)}
              className="rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs hover:text-foreground hover:underline"
            >
              {key}
            </TrailLink>
          </li>
        ))}
      </ul>
    </InsightsCard>
  );
}
