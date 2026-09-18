import { useId } from 'react';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { CopyField } from '@/components/shared/CopyField';
import { FieldInput } from '@/components/shared/form/FieldInput';
import type { KnownIntegrationResponseDto } from '@/lib/api';
import { secretLabel } from '@/lib/secret-label';

type IntegrationSecretsFieldsProps = {
  integration: KnownIntegrationResponseDto;
  values: Readonly<Record<string, string>>;
  onChange: (name: string, value: string) => void;
};

export function IntegrationSecretsFields({
  integration,
  values,
  onChange,
}: IntegrationSecretsFieldsProps) {
  const fields = useId();

  return (
    <section
      aria-labelledby={`${fields}-title`}
      className="flex flex-col gap-3 py-4"
    >
      <div className="flex items-center gap-2">
        <IntegrationLogo source={integration.source} />
        <h3
          id={`${fields}-title`}
          className="font-medium text-foreground text-sm"
        >
          {integration.name}
        </h3>
      </div>

      <fieldset
        aria-labelledby={`${fields}-delivery`}
        className="flex flex-col gap-1.5"
      >
        <span
          id={`${fields}-delivery`}
          className="text-muted-foreground text-xs"
        >
          Delivery URL
        </span>
        <CopyField
          value={integration.deliverTo}
          copyLabel={`Copy the delivery URL for ${integration.name}`}
        />
      </fieldset>

      {integration.secrets.map((name) => (
        <div key={name} className="flex flex-col gap-1.5">
          <label
            htmlFor={`${fields}-${name}`}
            className="text-muted-foreground text-xs"
          >
            {secretLabel(name, integration.source)}
          </label>
          <FieldInput
            id={`${fields}-${name}`}
            type="password"
            value={values[name] ?? ''}
            onChange={(event) => onChange(name, event.target.value)}
            autoComplete="new-password"
          />
        </div>
      ))}
    </section>
  );
}
