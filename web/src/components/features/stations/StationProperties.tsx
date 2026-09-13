import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { SkillsSelect } from '@/components/features/stations/SkillsSelect';

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
    <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-6 self-start lg:flex">
      {harness !== undefined && onHarness ? (
        <section className="flex flex-col gap-1">
          <h2 className="px-2 font-medium text-muted-foreground text-xs">
            Worked by
          </h2>

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
        </section>
      ) : null}

      {skills !== undefined && onSkills ? (
        <section className="flex flex-col gap-1">
          <h2 className="px-2 font-medium text-muted-foreground text-xs">
            Skills
          </h2>

          <SkillsSelect teamId={teamId} value={skills} onChange={onSkills} />
        </section>
      ) : null}

      {note ? (
        <p className="px-2 text-muted-foreground text-xs leading-5">{note}</p>
      ) : null}

      <section className="flex flex-col gap-1">
        <h2 className="px-2 font-medium text-muted-foreground text-xs">
          Line Repositories
        </h2>

        <RepositoriesSelect
          slug={slug}
          value={repositories}
          onChange={onRepositories}
        />
      </section>
    </aside>
  );
}
