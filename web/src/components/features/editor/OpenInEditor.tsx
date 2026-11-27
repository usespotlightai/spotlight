import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';

import { EditorLogo } from '@/components/features/editor/EditorLogo';
import { EditorMenuItems } from '@/components/features/editor/EditorMenuItems';
import { EditorSetupPopover } from '@/components/features/editor/EditorSetupPopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEditorLaunch } from '@/hooks/useEditorLaunch';
import { EDITOR_NAMES, type SandboxTarget } from '@/lib/editor';

export const EDITOR_MENU =
  'pointer-coarse:[&_[data-slot=dropdown-menu-item]]:min-h-10';

type OpenInEditorProps = {
  slug: string;
  target: SandboxTarget;
};

export function OpenInEditor({ slug, target }: OpenInEditorProps) {
  const editor = useEditorLaunch(slug, target);
  const group = useRef<HTMLDivElement>(null);
  const app = editor.preferred;
  const label = `Open in ${EDITOR_NAMES[app]}`;
  const named = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState(false);

  return (
    <div
      ref={group}
      className="flex h-7 items-center rounded-lg pointer-coarse:h-10 text-[0.8rem] font-medium transition-colors hover:bg-muted has-aria-expanded:bg-muted dark:hover:bg-muted/50"
    >
      <Tooltip
        open={tip}
        onOpenChange={(open) => setTip(open && !named.current?.offsetParent)}
      >
        <TooltipTrigger
          render={
            <a
              href={editor.linkTo(app)}
              aria-label={label}
              onClick={() => editor.followed(app)}
              className="flex h-full items-center gap-1.5 rounded-l-lg pl-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <EditorLogo app={app} />
              <span
                ref={named}
                className="hidden whitespace-nowrap @2xl/pane:inline"
              >
                {label}
              </span>
            </a>
          }
        />
        <TooltipContent side="bottom" align="center">
          {label}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Choose the editor"
          className="flex h-full items-center rounded-r-lg pr-2 pl-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground"
        >
          <ChevronDown aria-hidden className="size-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          anchor={group}
          align="start"
          sideOffset={4}
          className={EDITOR_MENU}
        >
          <EditorMenuItems onChoose={editor.open} />
        </DropdownMenuContent>
      </DropdownMenu>

      <EditorSetupPopover anchor={group} setup={editor.setup} />
    </div>
  );
}
