import { MemoryBodyInput } from '@/components/features/memory/MemoryBodyInput';
import type { useMemoryDraft } from '@/hooks/useMemoryDraft';

type MemoryBodyCellProps = {
  body: string;
  expanded: boolean;
  changing: boolean;
  draft: ReturnType<typeof useMemoryDraft>;
  onToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export function MemoryBodyCell({
  body,
  expanded,
  changing,
  draft,
  onToggle,
  onSave,
  onCancel,
}: MemoryBodyCellProps) {
  if (changing) {
    return (
      <MemoryBodyInput
        value={draft.body}
        onChange={draft.setBody}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="min-w-0 whitespace-pre-wrap break-words text-left text-foreground leading-5 outline-none after:absolute after:inset-0 after:rounded-md focus-visible:underline group-data-clamped/row:truncate"
    >
      {body}
    </button>
  );
}
