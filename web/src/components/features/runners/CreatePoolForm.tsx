import { type SubmitEvent, useId, useState } from 'react';

import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import { nonEmpty } from '@/lib/non-empty';

type CreatePoolFormProps = {
  defaultName: string;
  creating: boolean;
  refusal: string | null;
  onCreate: (name: string) => void;
  onEdit: () => void;
};

export function CreatePoolForm({
  defaultName,
  creating,
  refusal,
  onCreate,
  onEdit,
}: CreatePoolFormProps) {
  const nameId = useId();
  const [name, setName] = useState(defaultName);
  const named = name.trim();

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
          spellCheck={false}
          disabled={creating}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            onEdit();
          }}
        />

        <Button type="submit" disabled={!named || creating}>
          Create pool
        </Button>
      </div>

      {nonEmpty(refusal) && (
        <p role="alert" className="text-destructive text-xs">
          {refusal}
        </p>
      )}
    </form>
  );
}
