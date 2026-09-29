import { type SubmitEvent, useId, useState } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import { RunnerPoolNameTakenError } from '@/hooks/api/useCreateRunnerPool';
import { messageOf } from '@/lib/error';
import { sanitizeSlug, slugify } from '@/lib/slug';

const SUGGESTED_NAME = 'my-computer';

const LONGEST_NAME = 64;

type CreatePoolFormProps = {
  creating: boolean;
  error: unknown;
  onCreate: (name: string) => void;
  onEdit: () => void;
};

const refusal = (error: unknown): string =>
  error instanceof RunnerPoolNameTakenError
    ? `A pool named ${error.pool} already exists. Choose another name.`
    : messageOf(error);

export function CreatePoolForm({
  creating,
  error,
  onCreate,
  onEdit,
}: CreatePoolFormProps) {
  const nameId = useId();
  const hintId = useId();
  const errorId = useId();
  const [name, setName] = useState(SUGGESTED_NAME);
  const named = slugify(name);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (named) {
      onCreate(named);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-1.5">
      <label htmlFor={nameId} className="font-medium text-foreground text-xs">
        Pool name
      </label>

      <div className="flex gap-2">
        <FieldInput
          id={nameId}
          name="name"
          required
          autoComplete="off"
          maxLength={LONGEST_NAME}
          disabled={creating}
          aria-describedby={error ? errorId : hintId}
          aria-invalid={Boolean(error)}
          value={name}
          onChange={(event) => {
            setName(sanitizeSlug(event.target.value));
            onEdit();
          }}
        />

        <Button type="submit" disabled={!named || creating}>
          Create pool
        </Button>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {refusal(error)}
        </p>
      ) : (
        <p id={hintId} className="text-muted-foreground text-xs">
          Lowercase words joined by dashes. It can’t be changed later.
        </p>
      )}
    </form>
  );
}
