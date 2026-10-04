import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { KIND_DESCRIPTIONS, KIND_LABELS, type MemoryKind } from '@/lib/memory';

export function MemoryKindLabel({ kind }: { kind: MemoryKind }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{KIND_LABELS[kind]}</TooltipTrigger>
      <TooltipContent className="max-w-64">
        {KIND_DESCRIPTIONS[kind]}
      </TooltipContent>
    </Tooltip>
  );
}
