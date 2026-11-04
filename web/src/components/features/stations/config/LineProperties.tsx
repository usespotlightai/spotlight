import { SquareMousePointer } from 'lucide-react';
import {
  Property,
  PropertyList,
} from '@/components/features/stations/config/PropertyList';
import { TabSection } from '@/components/features/stations/TabSection';
import { RepositoryHostLogo } from '@/components/shared/RepositoryHostLogo';
import type { LineResponseDto } from '@/lib/api';

const ICON = 'mt-0.75 size-3.5 shrink-0 text-muted-foreground';

type LinePropertiesProps = {
  line: LineResponseDto;
  skills: readonly string[];
};

export function LineProperties({ line, skills }: LinePropertiesProps) {
  return (
    <TabSection title="Line">
      <PropertyList>
        <Property label="Name">{line.name}</Property>
        <Property label="Repositories">
          {line.repositories.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            <ul aria-label="Repositories" className="flex flex-col gap-1.5">
              {line.repositories.map((repository) => (
                <li key={repository.fullName}>
                  <a
                    href={repository.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-start gap-2 hover:underline"
                  >
                    <RepositoryHostLogo
                      host={repository.host}
                      className={ICON}
                    />
                    <span className="min-w-0 break-words">
                      {repository.fullName}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Property>
        <Property label="Skills">
          {skills.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            <ul aria-label="Skills" className="flex flex-col gap-1.5">
              {skills.map((skill) => (
                <li key={skill} className="flex min-w-0 items-start gap-2">
                  <SquareMousePointer aria-hidden className={ICON} />
                  <span className="min-w-0 break-words">{skill}</span>
                </li>
              ))}
            </ul>
          )}
        </Property>
      </PropertyList>
    </TabSection>
  );
}
