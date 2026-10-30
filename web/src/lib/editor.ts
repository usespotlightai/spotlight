export type SandboxTarget = {
  readonly kind: 'task' | 'chat';
  readonly id: string;
};

export const EDITOR_APPS = ['vscode', 'cursor'] as const;

export type EditorApp = (typeof EDITOR_APPS)[number];

export const EDITOR_NAMES: Record<EditorApp, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
};

export const isEditorApp = (value: string): value is EditorApp =>
  (EDITOR_APPS as readonly string[]).includes(value);

const SPOTLIGHT_ADDRESS = 'https://app.usespotlight.ai';

export const sandboxAlias = (target: SandboxTarget, slug: string): string =>
  `${target.kind}-${target.id}.${slug}.spotlight`;

export const editorLink = (app: EditorApp, alias: string): string =>
  `${app}://vscode-remote/ssh-remote+${alias}/workspace`;

const atAddress = (command: string, origin: string): string =>
  origin === SPOTLIGHT_ADDRESS ? command : `${command} --url ${origin}`;

export type SetupStep = {
  readonly title: string;
  readonly command: string;
  readonly note?: string;
};

const EDITOR_TIMEOUT_SETTING = '"remote.SSH.connectTimeout": 600';

export const editorSetupSteps = (
  origin: string,
  app: EditorApp,
): readonly SetupStep[] => [
  {
    title: 'Install the Spotlight CLI',
    command: `curl -fsSL ${origin}/api/install.sh | sh`,
  },
  { title: 'Log in', command: atAddress('spotlight login', origin) },
  {
    title: 'Configure SSH',
    command: atAddress('spotlight ssh setup', origin),
  },
  {
    title: `Add to the ${EDITOR_NAMES[app]} settings`,
    command: EDITOR_TIMEOUT_SETTING,
    note: 'A stopped sandbox can take minutes to start. spotlight ssh setup can set this.',
  },
];
