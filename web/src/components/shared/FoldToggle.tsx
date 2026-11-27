import type { ReactElement } from 'react';

import { ExpandChevron } from '@/components/shared/ExpandChevron';

type FoldToggleProps = {
  folded: boolean;
  what: string;
  onToggle: () => void;
};

export function FoldToggle({
  folded,
  what,
  onToggle,
}: FoldToggleProps): ReactElement {
  return (
    <button
      type="button"
      aria-expanded={!folded}
      aria-label={folded ? `Show ${what}` : `Hide ${what}`}
      onClick={onToggle}
      className="flex size-6 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ExpandChevron open={!folded} className="size-3.5" />
    </button>
  );
}
