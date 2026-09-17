import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import type { LayerCheck } from '@/lib/change-stack';

type LayerCheckMarkProps = {
  check: LayerCheck;
};

export function LayerCheckMark({ check }: LayerCheckMarkProps) {
  switch (check.state) {
    case 'waiting':
      return (
        <LoaderCircle
          className="size-3.5 shrink-0 animate-spin text-faint"
          aria-label="Checking whether it builds"
        />
      );
    case 'passed':
      return (
        <CircleCheck
          className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-label="Builds on its own"
        />
      );
    case 'failed':
      return (
        <CircleX
          className="size-3.5 shrink-0 text-destructive"
          aria-label="Does not build on its own"
        />
      );
    default:
      return null;
  }
}
