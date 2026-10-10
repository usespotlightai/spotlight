import { pillClass } from '@/lib/pill';

type GitHubAppLinkProps = {
  href: string;
  installed: boolean;
};

export function GitHubAppLink({ href, installed }: GitHubAppLinkProps) {
  return (
    <a
      href={href}
      data-need={installed ? undefined : 'github'}
      className={pillClass(installed ? 'outline' : 'default')}
    >
      {installed ? 'Manage on GitHub' : 'Install on GitHub'}
    </a>
  );
}
