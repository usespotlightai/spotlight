import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';

const unchangeable = () => {};

type FixedRepositoriesProps = {
  slug: string;
  repositories: readonly string[];
  because: string;
};

export function FixedRepositories({
  slug,
  repositories,
  because,
}: FixedRepositoriesProps) {
  return (
    <RepositoriesSelect
      slug={slug}
      value={repositories}
      onChange={unchangeable}
      disabledBecause={because}
      className="h-6 w-auto"
    />
  );
}
