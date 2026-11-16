import { Hand } from 'lucide-react';

import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TakeOverButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="sm" onClick={onClick} />}
      >
        <Hand className="size-3.5" aria-hidden />
        Take over
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ShortcutHint id="task.take-over">
          Take the task from the line
        </ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
