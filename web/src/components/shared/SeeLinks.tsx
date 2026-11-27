import type { ReactElement } from 'react';

import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { TEXT_LINK } from '@/components/shared/text-link';

export type SeeLink = {
  key: string;
  label: string;
  title?: string;
} & (
  | { onClick: () => void; unavailable?: never }
  | { onClick?: never; unavailable: string }
);

export function SeeLinks({
  links,
}: {
  links: readonly SeeLink[];
}): ReactElement | null {
  if (links.length === 0) {
    return null;
  }

  return (
    <p
      data-slot="see-links"
      className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-sm leading-5"
    >
      <span>See</span>
      {links.map((link) =>
        link.unavailable !== undefined ? (
          <DisabledReasonTooltip key={link.key} reason={link.unavailable}>
            {(describedBy) => (
              <button
                type="button"
                aria-disabled="true"
                aria-describedby={describedBy}
                className="cursor-default text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                {link.label}
              </button>
            )}
          </DisabledReasonTooltip>
        ) : (
          <button
            key={link.key}
            type="button"
            title={link.title}
            onClick={link.onClick}
            className={TEXT_LINK}
          >
            {link.label}
          </button>
        ),
      )}
    </p>
  );
}
