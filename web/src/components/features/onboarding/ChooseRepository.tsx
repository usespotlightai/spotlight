import { type FormEvent, useId, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { usePinConfiguration } from '@/hooks/api/usePinConfiguration';
import { useRepositories } from '@/hooks/api/useRepositories';
import { cn } from '@/lib/utils';

type ChooseRepositoryProps = {
  slug: string | undefined;
  teamId: string | undefined;
  /** The account repositories are named under, fixed so only the name is typed. */
  owner: string | null;
  chosen: string | null;
  /** Squarer than a control standing on its own, so a row of them settles. */
  controlClassName?: string;
};

/** The same popup the menus wear, so one control does not read as two. */
const POPUP =
  'absolute top-full right-0 left-0 z-50 mt-1.5 max-h-64 origin-top animate-in overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 fade-in-0 zoom-in-95 slide-in-from-top-1';

/** What a name reads as once the owner it sits under is already shown. */
const under = (owner: string | null, fullName: string): string | null => {
  if (!owner) {
    return fullName;
  }

  const prefix = `${owner}/`;

  return fullName.startsWith(prefix) ? fullName.slice(prefix.length) : null;
};

/**
 * Which repository a team works in: one of the ones the App can already see,
 * or a name for one that is not there yet.
 *
 * The owner is the account the App is installed on and is shown rather than
 * typed, so a name that is only the team's to choose cannot be misspelt in the
 * part that is not. What is typed narrows the list rather than being checked
 * against it, so a name nobody has is still a name.
 */
export function ChooseRepository({
  slug,
  teamId,
  owner,
  chosen,
  controlClassName,
}: ChooseRepositoryProps) {
  const { data: repositories } = useRepositories(slug);
  const pin = usePinConfiguration(teamId);
  const [named, setNamed] = useState(
    (chosen && under(owner, chosen)) ?? chosen ?? '',
  );
  const [open, setOpen] = useState(false);
  const listId = useId();

  const wanted = named.trim();
  const fullName = wanted && owner ? `${owner}/${wanted}` : wanted;

  const suggestions = (repositories ?? [])
    .map((each) => under(owner, each.fullName))
    .filter(
      (each): each is string =>
        each !== null &&
        each !== wanted &&
        each.toLowerCase().includes(wanted.toLowerCase()),
    );

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    setOpen(false);

    const next = fullName || null;

    if (next !== chosen) {
      pin.mutate(next);
    }
  };

  return (
    <form onSubmit={confirm} className="flex flex-wrap items-center gap-2">
      <div className="relative w-72 max-w-full">
        <div className="flex h-7 items-center rounded-lg border-[0.5px] border-input bg-background px-3 text-sm focus-within:border focus-within:border-ring">
          {owner && (
            <span className="shrink-0 text-muted-foreground">{owner}/</span>
          )}
          <input
            value={named}
            onChange={(event) => {
              setNamed(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // Late enough that a press on the list is heard first, which is
            // what makes clicking one of them choose it.
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
            disabled={pin.isPending}
            spellCheck={false}
            autoComplete="off"
            placeholder={owner ? 'name' : 'owner/name'}
            aria-label="Repository"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open && suggestions.length > 0}
            className="h-full w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {open && suggestions.length > 0 && (
          <ul id={listId} className={POPUP}>
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  // Chosen before the field is left, or the list would be
                  // gone by the time the press landed.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setNamed(name);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-default items-center rounded-md px-1.5 py-1 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                >
                  <span className="truncate">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        // Emptying it is how a choice is taken off, so an empty field is only
        // nothing to say where nothing was chosen.
        disabled={pin.isPending || (wanted === '' && !chosen)}
        className={cn(buttonVariants({ size: 'sm' }), controlClassName)}
      >
        {pin.isPending ? 'Setting up…' : 'Confirm'}
      </button>
    </form>
  );
}
