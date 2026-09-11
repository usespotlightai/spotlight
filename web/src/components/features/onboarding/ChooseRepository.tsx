import { type FormEvent, useState } from 'react';
import { RepositoryField } from '@/components/shared/form/RepositoryField';
import { buttonVariants } from '@/components/ui/button';
import { usePinConfiguration } from '@/hooks/api/usePinConfiguration';
import { fullNameOf, nameUnder } from '@/lib/repository';
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

/**
 * Which repository a team works in: one of the ones the App can already see,
 * or a name for one that is not there yet. Pinned when confirmed.
 */
export function ChooseRepository({
  slug,
  teamId,
  owner,
  chosen,
  controlClassName,
}: ChooseRepositoryProps) {
  const pin = usePinConfiguration(teamId);
  const [named, setNamed] = useState(
    (chosen && nameUnder(owner, chosen)) ?? chosen ?? '',
  );

  const wanted = named.trim();
  const fullName = fullNameOf(owner, named);

  const confirm = (event: FormEvent) => {
    event.preventDefault();

    const next = fullName || null;

    if (next !== chosen) {
      pin.mutate(next);
    }
  };

  return (
    <form onSubmit={confirm} className="flex w-full flex-col gap-3">
      <RepositoryField
        slug={slug}
        owner={owner}
        value={named}
        onChange={setNamed}
        disabled={pin.isPending}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          // Emptying it is how a choice is taken off, so an empty field is only
          // nothing to say where nothing was chosen.
          disabled={pin.isPending || (wanted === '' && !chosen)}
          className={cn(buttonVariants({ size: 'sm' }), controlClassName)}
        >
          {pin.isPending ? 'Setting up…' : 'Confirm'}
        </button>
      </div>
    </form>
  );
}
