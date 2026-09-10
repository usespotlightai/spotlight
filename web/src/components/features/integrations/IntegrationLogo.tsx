import { Webhook } from 'lucide-react';
import { siGrafana, siLinear, siPagerduty, siSentry } from 'simple-icons';
import { cn } from '@/lib/utils';

/** Just enough of an icon to draw it: its name, its colour, and its shape. */
interface Logo {
  readonly title: string;
  readonly hex: string;
  readonly path: string;
}

const logos: Record<string, Logo> = {
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
  // Slack's mark is four colours, not one, so it is its own rather than a
  // monochrome path like the rest.
  if (source === 'slack') {
    return <SlackMark className={cn('size-5 shrink-0', className)} />;
  }

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

/** The Slack mark in its four brand colours. */
function SlackMark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Slack"
      viewBox="0 0 122.8 122.8"
      className={className}
    >
      <path
        fill="#E01E5A"
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
      />
      <path
        fill="#36C5F0"
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
      />
      <path
        fill="#2EB67D"
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
      />
      <path
        fill="#ECB22E"
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
      />
    </svg>
  );
}
