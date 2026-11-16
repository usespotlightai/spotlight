import type { ReactNode } from 'react';

import { docsUrl } from '@/lib/docs';
import { type PillSize, pillClass } from '@/lib/pill';

type DocsPillLinkProps = {
  page: string;
  size?: PillSize;
  children: ReactNode;
};

export function DocsPillLink({
  page,
  size = 'regular',
  children,
}: DocsPillLinkProps) {
  return (
    <a
      href={docsUrl(page)}
      target="_blank"
      rel="noreferrer"
      className={pillClass('outline', undefined, size)}
    >
      {children}
    </a>
  );
}
