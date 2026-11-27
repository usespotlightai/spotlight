import { Check, Copy } from 'lucide-react';
import type { ReactElement } from 'react';

export function CopyIcon({
  copied,
  className,
}: {
  copied: boolean;
  className?: string;
}): ReactElement {
  const Icon = copied ? Check : Copy;

  return <Icon className={className} aria-hidden />;
}
