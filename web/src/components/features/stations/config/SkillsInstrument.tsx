import { SquareMousePointer } from 'lucide-react';
import { Instrument } from '@/components/features/stations/config/Instrument';
import { InstrumentValue } from '@/components/features/stations/config/InstrumentValue';
import { StationSkills } from '@/components/features/stations/config/StationSkills';

export function SkillsInstrument({ skills }: { skills: readonly string[] }) {
  return (
    <Instrument title="Skills">
      <InstrumentValue
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
      </InstrumentValue>

      {skills.length > 0 && <StationSkills skills={skills} />}
    </Instrument>
  );
}
