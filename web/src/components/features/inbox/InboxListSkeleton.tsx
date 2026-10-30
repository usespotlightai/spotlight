import { InboxRowSkeleton } from '@/components/features/inbox/InboxRowSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';

type SkeletonSection = {
  open: boolean;
  onToggle: () => void;
};

type InboxListSkeletonProps = {
  open: SkeletonSection;
  running: SkeletonSection;
  resolved: SkeletonSection;
};

function SectionSkeleton({
  label,
  section,
}: {
  label: string;
  section: SkeletonSection;
}) {
  return (
    <>
      <DisclosureRow
        label={label}
        count={<SkeletonLine className="w-2" />}
        open={section.open}
        onToggle={section.onToggle}
        className="pl-2 font-medium text-xs"
      />

      <Disclosure open={section.open}>
        <li>
          <InboxRowSkeleton />
        </li>
      </Disclosure>
    </>
  );
}

export function InboxListSkeleton({
  open,
  running,
  resolved,
}: InboxListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the inbox"
      className="flex flex-1 flex-col"
    >
      <SectionSkeleton label="Open" section={open} />

      <div className="mt-auto pt-4">
        <SectionSkeleton label="Running" section={running} />
        <SectionSkeleton label="Resolved" section={resolved} />
      </div>
    </div>
  );
}
