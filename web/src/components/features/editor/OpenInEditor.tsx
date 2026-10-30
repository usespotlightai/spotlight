import { ChevronDown } from 'lucide-react';
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

type OpenInEditorProps = {
  slug: string;
  target: SandboxTarget;
};

export function OpenInEditor({ slug, target }: OpenInEditorProps) {
  const editor = useEditorLaunch(slug, target);
  const group = useRef<HTMLDivElement>(null);
  const app = editor.preferred;

  return (
    <div
      ref={group}
      className="flex h-7 items-center rounded-lg text-[0.8rem] font-medium transition-colors hover:bg-muted has-aria-expanded:bg-muted dark:hover:bg-muted/50"
    >
      <a
        href={editor.linkTo(app)}
        onClick={() => editor.followed(app)}
        className="flex h-full items-center gap-1.5 rounded-l-lg pl-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <EditorLogo app={app} />
        Open in {EDITOR_NAMES[app]}
      </a>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Choose the editor"
          className="flex h-full items-center rounded-r-lg pr-2 pl-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground"
        >
          <ChevronDown aria-hidden className="size-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent anchor={group} align="start" sideOffset={4}>
          <EditorMenuItems onChoose={editor.open} />
        </DropdownMenuContent>
      </DropdownMenu>

      <EditorSetupPopover anchor={group} setup={editor.setup} />
    </div>
  );
}
