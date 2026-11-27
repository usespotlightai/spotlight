import type { ReactElement, RefObject } from 'react';

import { EditorSetup } from '@/components/features/editor/EditorSetup';
import { Popover, PopoverContent } from '@/components/ui/popover';
import type { EditorSetupState } from '@/hooks/useEditorLaunch';

type EditorSetupPopoverProps = {
  anchor: RefObject<HTMLElement | null>;
  setup: EditorSetupState;
};

export function EditorSetupPopover({
  anchor,
  setup,
}: EditorSetupPopoverProps): ReactElement {
  return (
    <Popover
      open={setup.open}
      onOpenChange={(opened) => {
        if (!opened) {
          setup.close();
        }
      }}
    >
      <PopoverContent anchor={anchor} align="end" sideOffset={6}>
        <EditorSetup
          app={setup.app}
          reason={setup.reason}
          origin={window.location.origin}
        />
      </PopoverContent>
    </Popover>
  );
}
