import {
  Binoculars,
  Braces,
  FileText,
  type LucideIcon,
  MousePointer2,
} from 'lucide-react';
import { isCode, type Reference } from '@/lib/chat-input';
import { cn } from '@/lib/utils';

const SHARED: Record<Exclude<Reference['kind'], 'file'>, LucideIcon> = {
  trace: Binoculars,
  station: MousePointer2,
};

export function ReferenceIcon({ reference }: { reference: Reference }) {
  const code = reference.kind === 'file' && isCode(reference.name);
  const Icon =
    reference.kind === 'file'
      ? code
        ? Braces
        : FileText
      : SHARED[reference.kind];

  return (
    <Icon
      aria-hidden
      className={cn(
        'size-3.5 shrink-0 self-center',
        reference.kind !== 'file'
          ? 'text-primary'
          : code
            ? 'text-amber-500'
            : 'text-muted-foreground',
      )}
    />
  );
}
