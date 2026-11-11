import {
  type ContextMenuParams,
  clipboard,
  Menu,
  type MenuItemConstructorOptions,
  shell,
  type WebContents,
} from 'electron';

const MAX_SUGGESTIONS = 5;

const isWebLink = (url: string) => /^https?:\/\//.test(url);

export const contextMenuOf = (
  params: ContextMenuParams,
  contents: WebContents,
): MenuItemConstructorOptions[] => {
  const spelling: MenuItemConstructorOptions[] = params.misspelledWord
    ? [
        ...params.dictionarySuggestions
          .slice(0, MAX_SUGGESTIONS)
          .map((suggestion): MenuItemConstructorOptions => ({
            label: suggestion,
            click: () => contents.replaceMisspelling(suggestion),
          })),
        ...(params.dictionarySuggestions.length === 0
          ? [{ label: 'No guesses found', enabled: false }]
          : []),
        {
          label: 'Learn Spelling',
          click: () =>
            contents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord,
            ),
        },
        { type: 'separator' },
      ]
    : [];

  const link: MenuItemConstructorOptions[] = isWebLink(params.linkURL)
    ? [
        {
          label: 'Open Link in Browser',
          click: () => void shell.openExternal(params.linkURL),
        },
        {
          label: 'Copy Link',
          click: () => void clipboard.writeText(params.linkURL),
        },
        { type: 'separator' },
      ]
    : [];

  const image: MenuItemConstructorOptions[] =
    params.mediaType === 'image'
      ? [
          {
            label: 'Copy Image',
            click: () => contents.copyImageAt(params.x, params.y),
          },
          { type: 'separator' },
        ]
      : [];

  const flags = params.editFlags;
  const editing: MenuItemConstructorOptions[] = params.isEditable
    ? [
        { role: 'cut', enabled: flags.canCut },
        { role: 'copy', enabled: flags.canCopy },
        { role: 'paste', enabled: flags.canPaste },
        { role: 'pasteAndMatchStyle', enabled: flags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: flags.canSelectAll },
      ]
    : params.selectionText.trim()
      ? [{ role: 'copy' }]
      : [];

  const items = [...spelling, ...link, ...image, ...editing];

  while (items.at(-1)?.type === 'separator') {
    items.pop();
  }

  return items;
};

export const withContextMenu = (contents: WebContents) => {
  contents.on('context-menu', (_event, params) => {
    const items = contextMenuOf(params, contents);

    if (items.length > 0) {
      Menu.buildFromTemplate(items).popup();
    }
  });
};
