import { SquareMousePointer } from 'lucide-react';
import { StationSection } from '@/components/features/stations/StationSection';
import { Pill } from '@/components/shared/Pill';

export function StationSkills({ skills }: { skills: readonly string[] }) {
  return (
    <StationSection title="Skills">
      {skills.length > 0 ? (
        <ul aria-label="Skills" className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li key={skill}>
              <Pill
                lead={<SquareMousePointer className="size-3" aria-hidden />}
              >
                {skill}
              </Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No skills.</p>
      )}
    </StationSection>
  );
}
