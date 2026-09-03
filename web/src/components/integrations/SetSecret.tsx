import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSetSecret } from '@/hooks/api/useSetSecret';

type SetSecretProps = {
  teamId: string | undefined;
  name: string;
  isSet: boolean;
};

/**
 * Takes a secret and does not give it back. Once set, the field empties and
 * says so: there is nothing to show, and showing a row of dots would only
 * suggest there were.
 */
export function SetSecret({ teamId, name, isSet }: SetSecretProps) {
  const [value, setValue] = useState('');
  const set = useSetSecret(teamId);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) {
          set.mutate({ name, value }, { onSuccess: () => setValue('') });
        }
      }}
    >
      <input
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={isSet ? 'Set. Type to replace it.' : `Paste ${name}`}
        aria-label={name}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 font-mono text-foreground text-xs placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
      />

      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={set.isPending || value.trim().length === 0}
        className="rounded-full bg-card shadow-none"
      >
        {set.isPending ? 'Saving…' : isSet ? 'Replace' : 'Save'}
      </Button>
    </form>
  );
}
