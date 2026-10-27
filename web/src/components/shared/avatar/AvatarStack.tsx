import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Person = {
  readonly name: string;
  readonly image: string | null;
};

type AvatarStackProps = {
  people: readonly Person[];
  label: string;
  className?: string;
};

export function AvatarStack({ people, label, className }: AvatarStackProps) {
  if (people.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className={cn('flex -space-x-1.5 outline-none', className)}
          />
        }
      >
        {people.map((person, at) => (
          <PersonAvatar
            // biome-ignore lint/suspicious/noArrayIndexKey: two people can share a name, and the order does not change while shown
            key={at}
            person={person}
            className="after:hidden"
          />
        ))}
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
