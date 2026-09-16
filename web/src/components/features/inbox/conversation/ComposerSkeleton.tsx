import { ArrowUp, Paperclip } from 'lucide-react';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Button } from '@/components/ui/button';

const SETTING = 'flex h-7 items-center px-2 text-sm';

export function ComposerSkeleton({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-1 shadow-xs">
      <div className="px-2 py-0.5 text-muted-foreground text-sm leading-6">
        <p>{placeholder}</p>
        <span className="block h-lh" />
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="flex h-7 items-center gap-2 rounded-md border border-transparent px-2 text-muted-foreground text-sm">
            <Paperclip className="size-3.5" aria-hidden />
            Attachments
          </span>
          <span className={SETTING}>
            <SkeletonLine className="w-20" />
          </span>
          <span aria-hidden className="-ml-1.5 text-muted-foreground text-sm">
            ·
          </span>
          <span className={`-ml-1.5 ${SETTING}`}>
            <SkeletonLine className="w-16" />
          </span>
          <span className={SETTING}>
            <SkeletonLine className="w-28" />
          </span>
        </div>

        <Button
          type="button"
          size="icon-sm"
          className="rounded-full"
          disabled
          aria-hidden
        >
          <ArrowUp />
        </Button>
      </div>
    </div>
  );
}
