import { Fingerprint } from '@/components/shared/Fingerprint';
import { ChoiceCard } from '@/components/shared/form/ChoiceCard';

type CandidateChoiceProps = {
  value: string;
  name: string;
  detail?: string;
  fingerprint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
};

export function CandidateChoice({
  value,
  name,
  detail,
  fingerprint,
  checked,
  disabled,
  onChange,
}: CandidateChoiceProps) {
  return (
    <ChoiceCard
      group="candidate"
      value={value}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    >
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
      {fingerprint && (
        <Fingerprint
          fingerprint={fingerprint}
          className="shrink-0 text-muted-foreground text-xs"
        />
      )}
      {detail && (
        <span className="hidden shrink-0 text-muted-foreground text-xs sm:inline">
          {detail}
        </span>
      )}
    </ChoiceCard>
  );
}
