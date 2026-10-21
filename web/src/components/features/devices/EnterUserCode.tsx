import { type SubmitEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import { devicePath, enteredUserCode } from '@/lib/device';

export function EnterUserCode() {
  const codeId = useId();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const code = enteredUserCode(typed);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void navigate(devicePath(code));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label htmlFor={codeId} className="sr-only">
        Code
      </label>
      <FieldInput
        id={codeId}
        name="code"
        type="text"
        required
        autoFocus
        autoComplete="off"
        placeholder="ABCD-EFGH"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="h-9 bg-card text-center tracking-widest"
      />

      <Button
        type="submit"
        size="lg"
        disabled={code === ''}
        className="self-center rounded-full px-6"
      >
        Continue
      </Button>
    </form>
  );
}
