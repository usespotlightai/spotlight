import { MemberRole } from '@/components/features/settings/MemberRole';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { MemberResponseDto } from '@/lib/api';
import { initialsOf } from '@/lib/person';
import type { Role } from '@/lib/role';

type TeamMemberRowProps = {
  member: MemberResponseDto;
  onOffer: readonly Role[];
  onChange: (role: Role) => void;
  pending?: boolean;
};

export function TeamMemberRow({
  member,
  onOffer,
  onChange,
  pending,
}: TeamMemberRowProps) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <Avatar size="sm">
        {member.image && <AvatarImage src={member.image} alt="" />}
        <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
      </Avatar>

      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {member.name}
      </span>

      <MemberRole
        name={member.name}
        role={member.role}
        onOffer={onOffer}
        onChange={onChange}
        pending={pending}
      />
    </div>
  );
}
