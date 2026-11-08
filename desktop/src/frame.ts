const TITLE_BAR_HEIGHT = 32;

export const TRAFFIC_LIGHTS = { x: 20, y: 15 };

const INTERACTIVE = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  "[role='button']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='combobox']",
  "[contenteditable='true']",
].join(', ');

export const FRAME_CSS = `
body::before {
  content: '';
  position: fixed;
  inset: 0 0 auto;
  height: 40px;
  pointer-events: none;
  -webkit-app-region: drag;
}

:is(${INTERACTIVE}) {
  -webkit-app-region: no-drag;
}

html:not([data-desktop='mac']) body {
  box-sizing: border-box;
  padding-top: ${TITLE_BAR_HEIGHT}px;
}

html:not([data-desktop='mac']) #root > * {
  height: calc(100svh - ${TITLE_BAR_HEIGHT}px) !important;
  min-height: calc(100svh - ${TITLE_BAR_HEIGHT}px) !important;
}
`;
