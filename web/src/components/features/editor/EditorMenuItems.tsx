import { EditorLogo } from '@/components/features/editor/EditorLogo';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EDITOR_APPS, EDITOR_NAMES, type EditorApp } from '@/lib/editor';

type EditorMenuItemsProps = {
  onChoose: (app: EditorApp) => void;
};

export function EditorMenuItems({ onChoose }: EditorMenuItemsProps) {
  return EDITOR_APPS.map((app) => (
    <DropdownMenuItem key={app} closeOnClick onClick={() => onChoose(app)}>
      <EditorLogo app={app} />
      Open in {EDITOR_NAMES[app]}
    </DropdownMenuItem>
  ));
}
