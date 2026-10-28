import type { ComponentType, SVGProps } from 'react';
import { GithubLogo } from '@/components/shared/icons';
import type { LineRepositoryResponseDto } from '@/lib/api';

const LOGOS: Record<
  LineRepositoryResponseDto['host'],
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  github: GithubLogo,
};

export function RepositoryHostLogo({
  host,
  className,
}: {
  host: LineRepositoryResponseDto['host'];
  className?: string;
}) {
  const Logo = LOGOS[host];

  return <Logo aria-hidden className={className} />;
}
