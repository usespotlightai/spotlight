import type { ReactNode, ReactElement } from 'react';

import { TEXT_LINK } from '@/components/shared/text-link';
import { cn } from '@/lib/utils';

type ExternalTextLinkProps = {
  href: string;
  title?: string;
  className?: string;
  children: ReactNode;
};

export function ExternalTextLink({
  href,
  title,
  className,
  children,
}: ExternalTextLinkProps): ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn(TEXT_LINK, className)}
    >
      {children}
    </a>
  );
}
