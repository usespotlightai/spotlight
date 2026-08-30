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

/** Whoever something belongs to, at the size a row has for them. */
export function PersonAvatar({ person, className }: PersonAvatarProps) {
  const [initial] = [...person.name.trim()];

  return (
    <Avatar size="sm" className={cn('shrink-0', className)}>
      {person.image && <AvatarImage src={person.image} alt={person.name} />}

      <AvatarFallback className="text-[0.625rem] uppercase group-data-[size=sm]/avatar:text-[0.625rem]">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
