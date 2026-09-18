import { type FormEvent, useState } from 'react';
import { RepositoryField } from '@/components/shared/form/RepositoryField';
import { buttonVariants } from '@/components/ui/button';
import { usePinConfiguration } from '@/hooks/api/usePinConfiguration';
import { fullNameOf, nameUnder } from '@/lib/repository';
import { cn } from '@/lib/utils';

type ChooseRepositoryProps = {
  slug: string | undefined;
  teamId: string | undefined;
  owner: string | null;
  chosen: string | null;
  controlClassName?: string;
};

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
          disabled={pin.isPending || (wanted === '' && !chosen)}
          className={cn(buttonVariants({ size: 'sm' }), controlClassName)}
        >
          {pin.isPending ? 'Setting up…' : 'Confirm'}
        </button>
      </div>
    </form>
  );
}
