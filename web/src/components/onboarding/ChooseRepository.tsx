import { type FormEvent, useId, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { usePinConfiguration } from '@/hooks/api/usePinConfiguration';
import { useRepositories } from '@/hooks/api/useRepositories';
import { cn } from '@/lib/utils';

type ChooseRepositoryProps = {
  slug: string | undefined;
  teamId: string | undefined;
  chosen: string | null;
  /** Squarer than a control standing on its own, so a row of them settles. */
  controlClassName?: string;
};

/** The same popup the menus wear, so one control does not read as two. */
const POPUP =
  'absolute top-full right-0 left-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10';

/**
 * Which repository a team works in: one of the ones the App can already see,
 * or a name for one that is not there yet.
 *
 * Typed rather than only picked, because the repository a team wants may not
 * exist until they say it does. What is typed narrows the list rather than
 * being checked against it, so a name nobody has is still a name, and a list
 * with nothing left in it simply goes away.
 */
export function ChooseRepository({
  slug,
  teamId,
  chosen,
  controlClassName,
}: ChooseRepositoryProps) {
  const { data: repositories } = useRepositories(slug);
  const pin = usePinConfiguration(teamId);
  const [named, setNamed] = useState(chosen ?? '');
  const [open, setOpen] = useState(false);
  const listId = useId();

  const wanted = named.trim();
  const suggestions = (repositories ?? [])
    .map((each) => each.fullName)
    .filter(
      (each) =>
        each !== wanted && each.toLowerCase().includes(wanted.toLowerCase()),
    );

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    setOpen(false);

    if (wanted !== (chosen ?? '')) {
      pin.mutate(wanted || null);
    }
  };

  return (
    <form onSubmit={confirm} className="flex flex-wrap items-center gap-2">
      <div className="relative w-72 max-w-full">
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
          placeholder="owner/name"
          aria-label="Repository"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          className="h-9 w-full rounded-lg border-[0.5px] border-input bg-background px-3 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border focus:border-ring"
        />

        {open && suggestions.length > 0 && (
          <ul id={listId} className={POPUP}>
            {suggestions.map((repository) => (
              <li key={repository}>
                <button
                  type="button"
                  // Chosen before the field is left, or the list would be
                  // gone by the time the press landed.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setNamed(repository);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-default items-center rounded-md px-1.5 py-1 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                >
                  <span className="truncate">{repository}</span>
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
