import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';

export const NOTE_BOX = 'rounded-lg bg-card px-2 py-1';

type PersonNoteProps = {
  person: { readonly name: string; readonly image: string | null };
  about: ReactNode;
  children: ReactNode;
};

export function PersonNote({ person, about, children }: PersonNoteProps) {
  return (
    <div className="flex gap-2.5">
      <PersonAvatar person={person} className="data-[size=sm]:size-7" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex h-7 items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{person.name}</span>
          {about}
        </p>

        {children}
      </div>
    </div>
  );
}
