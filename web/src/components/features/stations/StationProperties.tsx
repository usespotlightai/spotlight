import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { SkillsSelect } from '@/components/features/stations/SkillsSelect';
import { StationAside } from '@/components/features/stations/StationAside';
import { StationPropertiesSection } from '@/components/features/stations/StationPropertiesSection';

type StationPropertiesProps = {
  slug: string | undefined;
  teamId?: string;
  skills?: readonly string[];
  onSkills?: (skills: string[]) => void;
  harness?: string;
  onHarness?: (harness: string) => void;
  model?: string;
  onModel?: (model: string) => void;
  effort?: string;
  onEffort?: (effort: string) => void;
  note?: string;
  repositories: readonly string[];
  onRepositories: (repositories: string[]) => void;
};

export function StationProperties({
  slug,
  teamId,
  skills,
  onSkills,
  harness,
  onHarness,
  model,
  onModel,
  effort,
  onEffort,
  note,
  repositories,
  onRepositories,
}: StationPropertiesProps) {
  return (
    <StationAside>
      {harness !== undefined && onHarness ? (
        <StationPropertiesSection title="Worked by">
          <HarnessSelect value={harness} onChange={onHarness} />

          {harness &&
          model !== undefined &&
          onModel &&
          effort !== undefined &&
          onEffort ? (
            <ModelEffortSelect
              harness={harness}
              model={model}
              onModel={onModel}
              effort={effort}
              onEffort={onEffort}
            />
          ) : null}
        </StationPropertiesSection>
      ) : null}

      {skills !== undefined && onSkills ? (
        <StationPropertiesSection title="Skills">
          <SkillsSelect teamId={teamId} value={skills} onChange={onSkills} />
        </StationPropertiesSection>
      ) : null}

      {note ? (
        <p className="px-2 text-muted-foreground text-xs leading-5">{note}</p>
      ) : null}

      <StationPropertiesSection title="Line Repositories">
        <RepositoriesSelect
          slug={slug}
          value={repositories}
          onChange={onRepositories}
        />
      </StationPropertiesSection>
    </StationAside>
  );
}
