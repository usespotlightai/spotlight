import { useState } from 'react';
import { IntegrationSecretsFields } from '@/components/features/integrations/IntegrationSecretsFields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { KnownIntegrationResponseDto } from '@/lib/api';

type SecretsPromptProps = {
  integrations: readonly KnownIntegrationResponseDto[];
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (secrets: Record<string, string>) => void;
};

export function SecretsPrompt({
  integrations,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: SecretsPromptProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

  const needed = [...new Set(integrations.flatMap((each) => each.secrets))];
  const filled = (names: readonly string[]) =>
    names.every((name) => (values[name] ?? '').trim().length > 0);

  const current = integrations[Math.min(step, integrations.length - 1)];
  const stepped = integrations.length > 1;
  const last = step >= integrations.length - 1;

  const submit = () =>
    onSubmit(
      Object.fromEntries(needed.map((name) => [name, values[name] ?? ''])),
    );

  return (
    <Dialog open onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect {current?.name}</DialogTitle>
          <DialogDescription>
            {stepped && `Step ${step + 1} of ${integrations.length}. `}
            Point {current?.name} at its delivery URL and paste its secrets.
          </DialogDescription>
        </DialogHeader>

        {current && (
          <IntegrationSecretsFields
            key={current.source}
            integration={current}
            values={values}
            onChange={(name, value) =>
              setValues((held) => ({ ...held, [name]: value }))
            }
          />
        )}

        {last && error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}

        <DialogFooter>
          {step > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}

          {last ? (
            <Button
              size="sm"
              onClick={submit}
              disabled={!filled(needed) || pending}
            >
              {pending ? 'Opening…' : 'Open pull request'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!current || !filled(current.secrets)}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
