import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';

const unchangeable = () => {};

type FixedRepositoriesProps = {
  slug: string;
  repositories: readonly string[];
};

export function FixedRepositories({
  slug,
  repositories,
}: FixedRepositoriesProps) {
  return (
    <RepositoriesSelect
      slug={slug}
      value={repositories}
      onChange={unchangeable}
      readOnly
      className="h-6 w-auto"
    />
  );
}
