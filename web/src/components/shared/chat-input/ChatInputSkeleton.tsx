import { ArrowUp, Plus } from 'lucide-react';

import {
  ONE_LINE,
  STACKED,
} from '@/components/shared/chat-input/chat-input-layout';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export function ChatInputSkeleton({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'grid items-center gap-x-1 gap-y-2 rounded-2xl border border-border bg-card p-1.5 shadow-xs',
          STACKED,
          ONE_LINE,
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground [grid-area:plus]">
          <Plus className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 truncate px-1.5 text-muted-foreground text-sm leading-6 [grid-area:editor]">
          {placeholder}
        </p>
        <span className="flex h-7 items-center px-2 text-sm [grid-area:settings]">
          <SkeletonLine className="w-32" />
        </span>
        <span
          aria-hidden
          className={cn(
            buttonVariants({ size: 'icon-sm' }),
            'rounded-full opacity-50 [grid-area:send]',
          )}
        >
          <ArrowUp />
        </span>
      </div>

      <div className="flex h-6 items-center px-3 text-sm">
        <SkeletonLine className="w-24" />
      </div>
    </div>
  );
}
