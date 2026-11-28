import {
  TappableTooltip,
  type TooltipTarget,
} from '@/components/shared/TappableTooltip';

export function WithTooltip(target: TooltipTarget) {
  return <TappableTooltip {...target} trackCursorAxis="x" />;
}
