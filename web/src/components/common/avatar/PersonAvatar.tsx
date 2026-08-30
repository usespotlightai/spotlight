import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Person = {
  readonly name: string;
  readonly image: string | null;
};

type PersonAvatarProps = {
  person: Person;
  className?: string;
};

export function PersonAvatar({ person, className }: PersonAvatarProps) {
  const [initial] = [...person.name.trim()];

  return (
    <Avatar
      size="sm"
      className={cn(
        'shrink-0 after:mix-blend-normal dark:after:mix-blend-normal',
        className,
      )}
    >
      {person.image && <AvatarImage src={person.image} alt={person.name} />}

      <AvatarFallback className="bg-card text-[0.625rem] text-muted-foreground uppercase group-data-[size=sm]/avatar:text-[0.625rem]">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
