import { Undo2 } from 'lucide-react';

import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function HandBackButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="sm" onClick={onClick} />}
      >
        <Undo2 className="size-3.5" aria-hidden />
        Hand it back
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ShortcutHint id="task.hand-back">
          Hand the task back to the line
        </ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
