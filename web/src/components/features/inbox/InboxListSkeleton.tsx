import { InboxRowSkeleton } from '@/components/features/inbox/InboxRowSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';

type InboxListSkeletonProps = {
  open: boolean;
  onToggle: () => void;
};

export function InboxListSkeleton({ open, onToggle }: InboxListSkeletonProps) {
  return (
    <div role="status" aria-label="Loading the inbox">
      <DisclosureRow
        label="Open"
        count={<SkeletonLine className="w-2" />}
        open={open}
        onToggle={onToggle}
        className="pl-2 font-medium text-xs"
      />

      <Disclosure open={open}>
        <li>
          <InboxRowSkeleton />
        </li>
      </Disclosure>
    </div>
  );
}
