import { Image } from 'lucide-react';
import type { ReactElement } from 'react';

export function MissingImage({ name }: { name: string }): ReactElement {
  return (
    <span
      role="img"
      aria-label={name}
      className="flex size-full items-center justify-center bg-muted text-muted-foreground"
    >
      <Image aria-hidden className="size-4" />
    </span>
  );
}
