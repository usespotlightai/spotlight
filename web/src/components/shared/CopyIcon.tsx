import { Check, Copy } from 'lucide-react';

export function CopyIcon({
  copied,
  className,
}: {
  copied: boolean;
  className?: string;
}) {
  const Icon = copied ? Check : Copy;

  return <Icon className={className} aria-hidden />;
}
