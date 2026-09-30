import { shortFingerprint } from '@/lib/station-config';
import { cn } from '@/lib/utils';

type FingerprintProps = {
  fingerprint: string;
  className?: string;
};

export function Fingerprint({ fingerprint, className }: FingerprintProps) {
  return (
    <span
      data-slot="fingerprint"
      title={fingerprint}
      className={cn('font-mono', className)}
    >
      {shortFingerprint(fingerprint)}
    </span>
  );
}
