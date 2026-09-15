import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';

const unchangeable = () => undefined;

type FixedSettingsProps = {
  slug: string;
  harness: string | null | undefined;
  model: string | null | undefined;
  effort: string | null | undefined;
  repositories: readonly string[];
};

export function FixedSettings({
  slug,
  harness,
  model,
  effort,
  repositories,
}: FixedSettingsProps) {
  return (
    <>
      <HarnessSelect
        value={harness ?? ''}
        onChange={unchangeable}
        readOnly
        className="w-auto"
      />
      <span aria-hidden className="-ml-1.5 text-muted-foreground text-sm">
        ·
      </span>
      <ModelEffortSelect
        harness={harness ?? ''}
        model={model ?? ''}
        onModel={unchangeable}
        effort={effort ?? ''}
        onEffort={unchangeable}
        readOnly
        iconless
        className="-ml-1.5 w-auto"
      />
      <RepositoriesSelect
        slug={slug}
        value={repositories}
        onChange={unchangeable}
        readOnly
        className="w-auto"
      />
    </>
  );
}
