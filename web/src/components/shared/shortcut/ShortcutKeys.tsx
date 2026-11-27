import { Fragment, type ReactElement } from 'react';

import { Kbd } from '@/components/shared/shortcut/Kbd';
import { capsOf, type Keys, onMac, spokenOf } from '@/lib/commands/keys';
import { type ShortcutId, shortcutOf } from '@/lib/commands/shortcuts';
import { cn } from '@/lib/utils';

type ShortcutKeysProps = ({ id: ShortcutId } | { keys: Keys }) & {
  plain?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

export function ShortcutKeys({
  plain,
  size,
  className,
  ...shown
}: ShortcutKeysProps): ReactElement {
  const keys = 'id' in shown ? shortcutOf(shown.id).keys : shown.keys;
  const mac = onMac();

  return (
    <span
      data-slot="shortcut-keys"
      className={cn(
        'inline-flex shrink-0 items-center text-muted-foreground',
        plain === true ? 'gap-1' : 'gap-[3px]',
        className,
      )}
    >
      <span className="sr-only">{spokenOf(keys, mac)}</span>
      {keys.map((chord) => (
        <Fragment key={chord}>
          {chord !== keys[0] && (
            <span aria-hidden className="text-[11px]">
              then
            </span>
          )}
          <span aria-hidden className="contents">
            {capsOf(chord, mac).map((cap) => (
              <Kbd key={cap} plain={plain} size={size}>
                {cap}
              </Kbd>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
