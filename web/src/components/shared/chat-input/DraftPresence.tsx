import { AvatarStack } from '@/components/shared/avatar/AvatarStack';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import { namesOf } from '@/lib/people-list';

export function DraftPresence({ shared }: { shared: SharedDraft }) {
  return (
    <span className="ml-auto flex items-center gap-2">
      {!shared.online && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="text-muted-foreground text-xs outline-none" />
            }
          >
            Offline
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            Your changes stay here. They go to the others when the connection
            comes back.
          </TooltipContent>
        </Tooltip>
      )}

      <AvatarStack
        people={shared.others}
        label={`${namesOf(shared.others)} ${shared.others.length === 1 ? 'is' : 'are'} in this draft`}
      />
    </span>
  );
}
