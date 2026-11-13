import { useEffect, useState } from 'react';

import { useEditorConnection } from '@/hooks/api/useEditorConnection';
import { useLaunchCheck } from '@/hooks/useLaunchCheck';
import { useStoredState } from '@/hooks/useStoredState';
import {
  type EditorApp,
  type EditorSetupReason,
  editorLink,
  isEditorApp,
  type SandboxTarget,
  sandboxAlias,
} from '@/lib/editor';

const EDITOR_KEY = 'spotlight.editor-app';

const CONNECT_WAIT_MS = 20_000;
const WATCH_LIMIT_MS = 10 * 60_000;

export type EditorSetupState = {
  readonly open: boolean;
  readonly reason: EditorSetupReason;
  readonly app: EditorApp;
  readonly close: () => void;
};

function useConnectionWatch(target: SandboxTarget, slug: string) {
  const [since, setSince] = useState<number | null>(null);
  const [overdue, setOverdue] = useState(false);
  const connected = useEditorConnection(target, slug, since).data === true;

  useEffect(() => {
    if (since === null) {
      return;
    }

    const late = setTimeout(() => setOverdue(true), CONNECT_WAIT_MS);
    const done = setTimeout(() => {
      setSince(null);
      setOverdue(false);
    }, WATCH_LIMIT_MS);

    return () => {
      clearTimeout(late);
      clearTimeout(done);
    };
  }, [since]);

  return {
    overdue: overdue && since !== null && !connected,
    start: () => {
      setOverdue(false);
      setSince(Date.now());
    },
    stop: () => {
      setOverdue(false);
      setSince(null);
    },
  };
}

export function useEditorLaunch(slug: string, target: SandboxTarget) {
  const [stored, store] = useStoredState(EDITOR_KEY, 'vscode');
  const { missed, launched, dismiss } = useLaunchCheck();
  const watch = useConnectionWatch(target, slug);
  const preferred: EditorApp = isEditorApp(stored) ? stored : 'vscode';
  const [tried, setTried] = useState<EditorApp | null>(null);
  const alias = sandboxAlias(target, slug);

  const followed = (app: EditorApp) => {
    store(app);
    setTried(app);
    launched();
    watch.start();
  };

  const setup: EditorSetupState = {
    open: missed || watch.overdue,
    reason: missed ? 'not-opened' : 'not-connected',
    app: tried ?? preferred,
    close: () => {
      dismiss();
      watch.stop();
    },
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
