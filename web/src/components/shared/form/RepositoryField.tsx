import { GitBranch } from 'lucide-react';
import { useId, useState } from 'react';
import { useRepositories } from '@/hooks/api/useRepositories';
import { nameUnder } from '@/lib/repository';

/** The same popup the menus wear, so one control does not read as two. */
const POPUP =
  'absolute top-full right-0 left-0 z-50 mt-1.5 max-h-64 origin-top animate-in overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 fade-in-0 zoom-in-95 slide-in-from-top-1';

type RepositoryFieldProps = {
  slug: string | undefined;
  owner: string | null;
  /** The name typed, without the owner. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * What is typed narrows the list rather than being checked against it, so a
 * name nobody has yet is still a name.
 */
export function RepositoryField({
  slug,
  owner,
  value,
  onChange,
  disabled,
  autoFocus,
}: RepositoryFieldProps) {
  const { data: repositories } = useRepositories(slug);
  const [open, setOpen] = useState(false);
  const listId = useId();

  const wanted = value.trim();

  const suggestions = (repositories ?? [])
    .map((each) => nameUnder(owner, each.fullName))
    .filter(
      (each): each is string =>
        each !== null &&
        each !== wanted &&
        each.toLowerCase().includes(wanted.toLowerCase()),
    );

  return (
    <div className="relative rounded-lg border-[0.5px] border-border bg-card p-1 focus-within:border-ring">
      <div className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm">
        <GitBranch
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        {owner && (
          <span className="shrink-0 text-muted-foreground">{owner}/</span>
        )}
        <input
          // biome-ignore lint/a11y/noAutofocus: the caller opts a field into focus deliberately (a dialog)
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Late enough that a press on the list is heard first, which is what
          // makes clicking one of them choose it.
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
          disabled={disabled}
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
                // Chosen before the field is left, or the list would be gone by
                // the time the press landed.
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(name);
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
  );
}
