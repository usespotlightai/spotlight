import { DraggableInboxEntry } from '@/components/features/inbox/DraggableInboxEntry';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { entryKey, type InboxEntry } from '@/lib/inbox';

type InboxSectionProps = {
  slug: string;
  label: string;
  entries: readonly InboxEntry[];
  open: boolean;
  onToggle: () => void;
};

export function InboxSection({
  slug,
  label,
  entries,
  open,
  onToggle,
}: InboxSectionProps) {
  return (
    <>
      <DisclosureRow
        label={label}
        count={entries.length}
        open={open}
        onToggle={onToggle}
        className="pl-2 font-medium text-xs"
      />

      <Disclosure open={open}>
        {entries.map((entry) => (
          <DraggableInboxEntry
            key={entryKey(entry)}
            slug={slug}
            entry={entry}
          />
        ))}
      </Disclosure>
    </>
  );
}
