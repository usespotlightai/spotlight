import { GRANTS, REACHES, type TokenGrant, type TokenReach } from '@/lib/token';
import { cn } from '@/lib/utils';

const CHOICE =
  'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted';

type TokenAccessFieldProps = {
  reach: TokenReach;
  grants: ReadonlySet<TokenGrant>;
  disabled?: boolean;
  onReach: (reach: TokenReach) => void;
  onGrant: (grant: TokenGrant, granted: boolean) => void;
};

export function TokenAccessField({
  reach,
  grants,
  disabled,
  onReach,
  onGrant,
}: TokenAccessFieldProps) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium text-foreground text-xs">
        What it may do
      </legend>

      <div className="flex flex-col gap-0.5">
        {REACHES.map((each) => (
          <label
            key={each.id}
            className={cn(CHOICE, reach === each.id && 'bg-muted')}
          >
            <input
              type="radio"
              name="reach"
              value={each.id}
              checked={reach === each.id}
              onChange={() => onReach(each.id)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-foreground text-sm">{each.label}</span>
              <span className="text-muted-foreground text-xs">{each.told}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-0.5 border-border border-t-[0.5px] pt-1.5">
        {GRANTS.map((each) => (
          <label key={each.id} className={CHOICE}>
            <input
              type="checkbox"
              name={each.id}
              checked={grants.has(each.id)}
              onChange={(event) => onGrant(each.id, event.target.checked)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-foreground text-sm">{each.label}</span>
              <span className="text-muted-foreground text-xs">{each.told}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
