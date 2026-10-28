import { GitBranch } from 'lucide-react';
import { CheckboxSelect } from '@/components/features/stations/CheckboxSelect';
import { useRepositories } from '@/hooks/api/useRepositories';

type RepositoriesSelectProps = {
  slug: string | undefined;
  value: readonly string[];
  onChange: (repositories: string[]) => void;
  none?: string;
  disabledBecause?: string;
  className?: string;
};

export function RepositoriesSelect({
  slug,
  value,
  onChange,
  none = 'No repositories',
  disabledBecause,
  className,
}: RepositoriesSelectProps) {
  const { data: available } = useRepositories(slug);

  const names = [
    ...new Set([...(available ?? []).map((each) => each.fullName), ...value]),
  ].sort();

  return (
    <CheckboxSelect
      label="Repositories"
      icon={GitBranch}
      options={names}
      value={value}
      onChange={onChange}
      none={none}
      many={(count) => `${count} repositories`}
      empty="No repositories to choose from"
      disabledBecause={disabledBecause}
      className={className}
    />
  );
}
