import { Webhook } from 'lucide-react';
import {
  type SimpleIcon,
  siGrafana,
  siLinear,
  siPagerduty,
  siSentry,
} from 'simple-icons';
import { cn } from '@/lib/utils';

const logos: Record<string, SimpleIcon> = {
  linear: siLinear,
  sentry: siSentry,
  grafana: siGrafana,
  pagerduty: siPagerduty,
};

/**
 * A host's own mark where it has one. Anything a team wrote itself is a
 * webhook and nothing more, so it gets the plain one rather than a guess.
 */
export function IntegrationLogo({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const logo = logos[source];

  if (!logo) {
    return (
      <Webhook
        className={cn('size-5 text-muted-foreground', className)}
        aria-hidden
      />
    );
  }

  return (
    <svg
      role="img"
      aria-label={logo.title}
      viewBox="0 0 24 24"
      className={cn('size-5 shrink-0', className)}
      // Their own colour: a logo that is not its colour is a different logo.
      fill={`#${logo.hex}`}
    >
      <path d={logo.path} />
    </svg>
  );
}
