import { X } from 'lucide-react';
import type { ReactElement } from 'react';

import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ClearSelection({
  onClear,
}: {
  onClear: () => void;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Clear selection"
            className="rounded-full"
          />
        }
      >
        <X />
      </TooltipTrigger>
      <TooltipContent side="top">
        <ShortcutHint id="list.clear">Clear the selection</ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
