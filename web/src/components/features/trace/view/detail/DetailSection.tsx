import type { ReactElement, ReactNode } from 'react';

import { DetailCopy } from '@/components/features/trace/view/detail/DetailCopy';
import { PaneSection } from '@/components/shared/PaneSection';

export function DetailSection({
  title,
  copy,
  children,
}: {
  title: string;
  copy?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <PaneSection
      title={title}
      className="gap-1"
      action={
        copy !== undefined &&
        copy !== '' && (
          <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/section:opacity-100 pointer-coarse:opacity-100">
            <DetailCopy text={copy} of={title.toLowerCase()} />
          </span>
        )
      }
    >
      {children}
    </PaneSection>
  );
}
