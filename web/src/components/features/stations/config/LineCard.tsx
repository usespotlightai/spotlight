import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { Pill } from '@/components/shared/Pill';
import { RepositoryHostLogo } from '@/components/shared/RepositoryHostLogo';
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
            <li key={repository.fullName}>
              <Pill
                href={repository.url}
                lead={
                  <RepositoryHostLogo
                    host={repository.host}
                    className="size-3"
                  />
                }
              >
                {repository.fullName}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </ConfigCard>
  );
}
