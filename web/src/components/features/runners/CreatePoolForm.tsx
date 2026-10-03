import { type SubmitEvent, useId, useState } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import { RunnerPoolNameTakenError } from '@/hooks/api/useCreateRunnerPool';
import { messageOf } from '@/lib/error';
import { sanitizeSlug, slugify } from '@/lib/slug';

const LONGEST_NAME = 64;

type CreatePoolFormProps = {
  defaultName: string;
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
  defaultName,
  creating,
  error,
  onCreate,
  onEdit,
}: CreatePoolFormProps) {
  const nameId = useId();
  const errorId = useId();
  const [name, setName] = useState(defaultName);
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
          aria-describedby={error ? errorId : undefined}
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

      {Boolean(error) && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {refusal(error)}
        </p>
      )}
    </form>
  );
}
