import { useState } from 'react';
import { useLaunchCheck } from '@/hooks/useLaunchCheck';
import { useStoredState } from '@/hooks/useStoredState';
import {
  type EditorApp,
  editorLink,
  isEditorApp,
  type SandboxTarget,
  sandboxAlias,
} from '@/lib/editor';

const EDITOR_KEY = 'spotlight.editor-app';

export type EditorSetupState = {
  readonly open: boolean;
  readonly app: EditorApp;
  readonly close: () => void;
};

export function useEditorLaunch(slug: string, target: SandboxTarget) {
  const [stored, store] = useStoredState(EDITOR_KEY, 'vscode');
  const { missed, launched, dismiss } = useLaunchCheck();
  const preferred: EditorApp = isEditorApp(stored) ? stored : 'vscode';
  const [tried, setTried] = useState<EditorApp | null>(null);
  const alias = sandboxAlias(target, slug);

  const followed = (app: EditorApp) => {
    store(app);
    setTried(app);
    launched();
  };

  const setup: EditorSetupState = {
    open: missed,
    app: tried ?? preferred,
    close: dismiss,
  };

  return {
    preferred,
    linkTo: (app: EditorApp) => editorLink(app, alias),
    followed,
    open: (app: EditorApp) => {
      window.location.assign(editorLink(app, alias));
      followed(app);
    },
    setup,
  };
}
