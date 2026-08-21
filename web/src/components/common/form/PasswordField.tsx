import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type PasswordFieldProps = {
  id: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
};

export function PasswordField({
  id,
  autoComplete,
  placeholder = 'Password',
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Password
      </label>

      <input
        id={id}
        name="password"
        type={visible ? 'text' : 'password'}
        required
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border-[0.5px] border-input bg-background py-0 pr-11 pl-3 text-sm outline-none placeholder:text-muted-foreground"
      />

      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:text-foreground"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
