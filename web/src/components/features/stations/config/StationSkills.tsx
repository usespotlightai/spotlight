import { SquareMousePointer } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';

export function StationSkills({ skills }: { skills: readonly string[] }) {
  if (skills.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <ul aria-label="Skills" className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <li key={skill}>
          <Pill lead={<SquareMousePointer className="size-3" aria-hidden />}>
            {skill}
          </Pill>
        </li>
      ))}
    </ul>
  );
}
