import { LoaderCircle, Pencil } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AvatarChange } from '@/hooks/api/useAvatar';
import { messageOf } from '@/lib/error';
import { cn } from '@/lib/utils';

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif';

const EDITABLE =
  'group/avatar-edit relative flex rounded-lg outline-none transition-shadow hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card data-[popup-open]:ring-2 data-[popup-open]:ring-primary data-[popup-open]:ring-offset-2 data-[popup-open]:ring-offset-card disabled:pointer-events-none';

type AvatarSettingProps = {
  name: string;
  avatarUrl: string | null;
  editable: boolean;
  change: {
    readonly mutate: (change: AvatarChange) => void;
    readonly reset: () => void;
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: unknown;
  };
};

function Overlay({ pending }: { pending: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 text-white transition-opacity',
        pending
          ? 'opacity-100'
          : 'opacity-0 group-hover/avatar-edit:opacity-100 group-focus-visible/avatar-edit:opacity-100 group-data-[popup-open]/avatar-edit:opacity-100',
      )}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Pencil className="size-3.5" />
      )}
    </span>
  );
}

export function AvatarSetting({
  name,
  avatarUrl,
  editable,
  change,
}: AvatarSettingProps) {
  const picker = useRef<HTMLInputElement>(null);

  const send = (next: AvatarChange) => {
    change.reset();
    change.mutate(next);
  };

  const avatar = <InitialAvatar name={name} src={avatarUrl} size="lg" />;

  const face: ReactNode = (
    <>
      {avatar}
      <Overlay pending={change.isPending} />
    </>
  );

  const label = `Change the avatar of ${name}`;

  return (
    <SettingsRow label="Avatar" description="Recommended size is 256×256 px">
      {editable ? (
        <ActionWithAlert
          alert={
            change.isError
              ? messageOf(change.error, 'Sorry, the avatar couldn’t be saved.')
              : null
          }
        >
          {avatarUrl ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={label}
                disabled={change.isPending}
                className={EDITABLE}
              >
                {face}
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="min-w-44"
              >
                <DropdownMenuItem onClick={() => picker.current?.click()}>
                  Upload a new image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => send(null)}>
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              aria-label={label}
              disabled={change.isPending}
              className={EDITABLE}
              onClick={() => picker.current?.click()}
            >
              {face}
            </button>
          )}

          <input
            ref={picker}
            type="file"
            accept={ACCEPTED}
            hidden
            aria-label={`Avatar image for ${name}`}
            onChange={(event) => {
              const [file] = Array.from(event.target.files ?? []);
              event.target.value = '';

              if (file) {
                send(file);
              }
            }}
          />
        </ActionWithAlert>
      ) : (
        avatar
      )}
    </SettingsRow>
  );
}
