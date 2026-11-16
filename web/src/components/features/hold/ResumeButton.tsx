import { Play } from 'lucide-react';

import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ResumeButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="sm" onClick={onClick} />}
      >
        <Play className="size-3.5" aria-hidden />
        Resume
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ShortcutHint id="task.resume">Resume the line</ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
