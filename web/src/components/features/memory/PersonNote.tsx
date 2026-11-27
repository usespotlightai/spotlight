import type { ReactNode } from 'react';

export const NOTE_BOX = 'rounded-lg bg-card px-2 py-1';

type PersonNoteProps = {
  avatar: ReactNode;
  name: string;
  about?: ReactNode;
  children: ReactNode;
};

export function PersonNote({ avatar, name, about, children }: PersonNoteProps) {
  return (
    <div className="flex gap-2.5">
      {avatar}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex h-[26px] items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{name}</span>
          {about}
        </p>

        {children}
      </div>
    </div>
  );
}
