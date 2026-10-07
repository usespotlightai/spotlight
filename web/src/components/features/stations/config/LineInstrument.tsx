import { FolderGit2 } from 'lucide-react';
import { Instrument } from '@/components/features/stations/config/Instrument';
import { InstrumentValue } from '@/components/features/stations/config/InstrumentValue';
import { Pill } from '@/components/shared/Pill';
import type { LineResponseDto } from '@/lib/api';

export function LineInstrument({ line }: { line: LineResponseDto }) {
  const count = line.repositories.length;

  return (
    <Instrument title="Ships through">
      <InstrumentValue
        detail={`line · ${count} ${count === 1 ? 'repository' : 'repositories'}`}
      >
        {line.name}
      </InstrumentValue>

      {count > 0 && (
        <ul aria-label="Repositories" className="flex flex-wrap gap-1.5">
          {line.repositories.map((repository) => (
            <li key={repository}>
              <Pill lead={<FolderGit2 aria-hidden className="size-3" />}>
                {repository}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </Instrument>
  );
}
