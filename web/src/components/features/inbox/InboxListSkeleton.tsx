import { InboxRowSkeleton } from '@/components/features/inbox/InboxRowSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';

type InboxListSkeletonProps = {
  open: boolean;
  onToggleOpen: () => void;
  resolved: boolean;
  onToggleResolved: () => void;
};

export function InboxListSkeleton({
  open,
  onToggleOpen,
  resolved,
  onToggleResolved,
}: InboxListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the inbox"
      className="flex flex-1 flex-col"
    >
      <DisclosureRow
        label="Open"
        count={<SkeletonLine className="w-2" />}
        open={open}
        onToggle={onToggleOpen}
        className="pl-2 font-medium text-xs"
      />

      <Disclosure open={open}>
        <li>
          <InboxRowSkeleton />
        </li>
      </Disclosure>

      <div className="mt-auto pt-4">
        <DisclosureRow
          label="Resolved"
          count={<SkeletonLine className="w-2" />}
          open={resolved}
          onToggle={onToggleResolved}
          className="pl-2 font-medium text-xs"
        />

        <Disclosure open={resolved}>
          <li>
            <InboxRowSkeleton />
          </li>
        </Disclosure>
      </div>
    </div>
  );
}
