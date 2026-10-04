import {
  Binoculars,
  Braces,
  FileText,
  type LucideIcon,
  MousePointer2,
} from 'lucide-react';
import { isCode, type Reference } from '@/lib/chat-input';
import { cn } from '@/lib/utils';

const ICON: Record<Reference['kind'], LucideIcon> = {
  file: FileText,
  trace: Binoculars,
  station: MousePointer2,
};

const TINT: Record<Reference['kind'], string> = {
  file: 'text-muted-foreground',
  trace: 'text-primary',
  station: 'text-primary',
};

export function ReferenceIcon({ reference }: { reference: Reference }) {
  const code = reference.kind === 'file' && isCode(reference.name);
  const Icon = code ? Braces : ICON[reference.kind];

  return (
    <Icon
      aria-hidden
      className={cn(
        'size-3.5 shrink-0 self-center',
        code ? 'text-amber-500' : TINT[reference.kind],
      )}
    />
  );
}
