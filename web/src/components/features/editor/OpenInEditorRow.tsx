import { MoreHorizontal } from 'lucide-react';
import { useRef } from 'react';
import { EditorLogo } from '@/components/features/editor/EditorLogo';
import { EditorMenuItems } from '@/components/features/editor/EditorMenuItems';
import { EditorSetupPopover } from '@/components/features/editor/EditorSetupPopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditorLaunch } from '@/hooks/useEditorLaunch';
import { EDITOR_NAMES, type SandboxTarget } from '@/lib/editor';

type OpenInEditorRowProps = {
  slug: string;
  target: SandboxTarget;
};

export function OpenInEditorRow({ slug, target }: OpenInEditorRowProps) {
  const editor = useEditorLaunch(slug, target);
  const row = useRef<HTMLDivElement>(null);
  const app = editor.preferred;

  return (
    <div ref={row} className="group/editor relative flex w-full items-center">
      <a
        href={editor.linkTo(app)}
        onClick={() => editor.followed(app)}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 pr-8 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/editor:bg-accent group-has-[[data-popup-open]]/editor:bg-accent"
      >
        <EditorLogo app={app} />

        <span className="truncate text-foreground">
          Open in {EDITOR_NAMES[app]}
        </span>
      </a>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Choose the editor"
          className="absolute right-0.5 flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/editor:opacity-100 group-has-[a:focus-visible]/editor:opacity-100 data-[popup-open]:text-foreground data-[popup-open]:opacity-100"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent anchor={row} align="start" sideOffset={4}>
          <EditorMenuItems onChoose={editor.open} />
        </DropdownMenuContent>
      </DropdownMenu>

      <EditorSetupPopover anchor={row} setup={editor.setup} />
    </div>
  );
}
