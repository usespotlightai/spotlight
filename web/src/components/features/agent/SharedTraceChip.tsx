import { Binoculars } from 'lucide-react';
import type { ReactNode } from 'react';
import { AttachmentChip } from '@/components/shared/attachment/AttachmentChip';
import type { SharedTrace } from '@/lib/chat';

type SharedTraceChipProps = {
  trace: SharedTrace;
  trailing?: ReactNode;
  className?: string;
};

export function SharedTraceChip({
  trace,
  trailing,
  className,
}: SharedTraceChipProps) {
  return (
    <AttachmentChip
      name={trace.title}
      detail="Trace"
      lead={<Binoculars className="size-4" aria-hidden />}
      trailing={trailing}
      className={className}
    />
  );
}
