import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { settingsPath } from '@/lib/team';
import { cn } from '@/lib/utils';

const LOOKS = cn(buttonVariants({ size: 'sm' }), 'rounded-full');

type ConfigurationRepositoryLinkProps = {
  slug: string | undefined;
  teamId: string;
  repository: string | null;
};

export function ConfigurationRepositoryLink({
  slug,
  teamId,
  repository,
}: ConfigurationRepositoryLinkProps) {
  if (repository) {
    return (
      <a
        href={`https://github.com/${repository}`}
        target="_blank"
        rel="noreferrer"
        className={LOOKS}
      >
        Open on GitHub
      </a>
    );
  }

  if (!slug) {
    return null;
  }

  return (
    <Link to={settingsPath(slug, teamId, 'general')} className={LOOKS}>
      Choose a configuration repository
    </Link>
  );
}
