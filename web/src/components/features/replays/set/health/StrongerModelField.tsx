import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import type { useHarnesses } from '@/hooks/api/useHarnesses';
import { failed } from '@/lib/query';
import {
  type HarnessOffer,
  higherEffortsThan,
  type StationLive,
} from '@/lib/replay';
import {
  HARNESS_MODELS_UNREAD,
  MODEL_AND_EFFORT_LABEL,
  strongerHintShown,
} from '@/lib/replay-words';

type StrongerModelFieldProps = {
  live: StationLive & { readonly harness: string };
  harnesses: ReturnType<typeof useHarnesses>;
  offer: HarnessOffer;
  offerRead: boolean;
  model: string;
  effort: string;
  onModel: (model: string) => void;
  onEffort: (effort: string) => void;
  problem: string | null;
  disabled: boolean;
};

export function StrongerModelField({
  live,
  harnesses,
  offer,
  offerRead,
  model,
  effort,
  onModel,
  onEffort,
  problem,
  disabled,
}: StrongerModelFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-foreground text-xs">
        {MODEL_AND_EFFORT_LABEL}
      </span>
      <div className="-ml-2 flex">
        <ModelEffortSelect
          harness={live.harness}
          model={model}
          onModel={onModel}
          effort={effort}
          onEffort={onEffort}
          readOnly={disabled}
          iconless
          className="w-auto"
        />
      </div>
      {offerRead && (
        <p className="text-muted-foreground text-xs leading-5">
          {strongerHintShown(
            live.effort,
            offer.efforts[0] ?? null,
            higherEffortsThan(live.effort, offer),
          )}
        </p>
      )}
      {failed(harnesses) && (
        <CouldNotLoad
          what={HARNESS_MODELS_UNREAD}
          retrying={harnesses.isFetching}
          onRetry={() => void harnesses.refetch()}
          className="items-start"
        />
      )}
      {problem && (
        <p role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </div>
  );
}
