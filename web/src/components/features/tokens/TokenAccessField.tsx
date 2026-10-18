import {
  GRANTS,
  TOKEN_LEVELS,
  type TokenGrant,
  type TokenLevel,
} from '@/lib/token';
import { cn } from '@/lib/utils';

const CHOICE =
  'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted';

type TokenAccessFieldProps = {
  level: TokenLevel;
  grants: ReadonlySet<TokenGrant>;
  disabled: boolean;
  onLevel: (level: TokenLevel) => void;
  onGrant: (grant: TokenGrant, granted: boolean) => void;
};

export function TokenAccessField({
  level,
  grants,
  disabled,
  onLevel,
  onGrant,
}: TokenAccessFieldProps) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium text-foreground text-xs">
        What it may do
      </legend>

      <div className="flex flex-col gap-0.5">
        {TOKEN_LEVELS.map((each) => (
          <label
            key={each.id}
            className={cn(CHOICE, level === each.id && 'bg-muted')}
          >
            <input
              type="radio"
              name="level"
              value={each.id}
              checked={level === each.id}
              onChange={() => onLevel(each.id)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-foreground text-sm">{each.label}</span>
              <span className="text-muted-foreground text-xs">
                {each.description}
              </span>
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
              <span className="text-muted-foreground text-xs">
                {each.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
