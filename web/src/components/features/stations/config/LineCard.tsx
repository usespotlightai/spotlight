import { FolderGit2 } from 'lucide-react';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { Pill } from '@/components/shared/Pill';
import type { LineResponseDto } from '@/lib/api';

export function LineCard({ line }: { line: LineResponseDto }) {
  const count = line.repositories.length;

  return (
    <ConfigCard title="Line">
      <ConfigCardValue
        detail={`line · ${count} ${count === 1 ? 'repository' : 'repositories'}`}
      >
        {line.name}
      </ConfigCardValue>

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
    </ConfigCard>
  );
}
