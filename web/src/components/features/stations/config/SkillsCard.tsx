import { SquareMousePointer } from 'lucide-react';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { StationSkills } from '@/components/features/stations/config/StationSkills';

export function SkillsCard({ skills }: { skills: readonly string[] }) {
  return (
    <ConfigCard title="Skills">
      <ConfigCardValue
        lead={
          <SquareMousePointer
            aria-hidden
            className="size-4 text-muted-foreground"
          />
        }
        detail="enabled for its runs"
      >
        {skills.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          skills.length
        )}
      </ConfigCardValue>

      {skills.length > 0 && <StationSkills skills={skills} />}
    </ConfigCard>
  );
}
