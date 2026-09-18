import { CopyButton } from '@/components/shared/CopyButton';
import { ValueField } from '@/components/shared/ValueField';

type CopyFieldProps = {
  value: string;
  copyLabel: string;
};

export function CopyField({ value, copyLabel }: CopyFieldProps) {
  return (
    <ValueField value={value}>
      <CopyButton value={value} label={copyLabel} />
    </ValueField>
  );
}
