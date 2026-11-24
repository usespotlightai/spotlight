import type { Meta, StoryObj } from '@storybook/react-vite';

import { membersPath } from '@/lib/members';
import { extraSettingsPath } from '@/lib/settings';
import { NAVIGATE_EVENT } from '@/lib/settings-page-element';
import { SLUG } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';
import { type PageArgs, pageStory } from '@/stories/application';

const ELEMENT = 'x-demo-settings-page';

// A page element as a deployment writes one: a shadow root, the theme variables of the app, and one spotlight-navigate event.
class DemoSettingsPage extends HTMLElement {
  static readonly observedAttributes = ['workspace', 'role', 'theme'];

  readonly #root = this.attachShadow({ mode: 'open' });

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    this.#render();
  }

  #render() {
    const style = document.createElement('style');
    style.textContent = `
      section { display: flex; flex-direction: column; gap: 12px; padding: 16px;
        border: 1px solid var(--border); border-radius: var(--radius);
        background: var(--card); color: var(--foreground); font: inherit; font-size: 14px; }
      p { margin: 0; color: var(--muted-foreground); }
      button { align-self: flex-start; padding: 6px 12px; border: 0; border-radius: 999px;
        background: var(--primary); color: var(--primary-foreground); font: inherit; cursor: pointer; }
    `;

    const section = document.createElement('section');
    const heading = document.createElement('strong');
    heading.textContent = 'A page that the deployment adds';
    const detail = document.createElement('p');
    detail.textContent = `Workspace ${this.getAttribute('workspace') ?? '?'}, role ${this.getAttribute('role') ?? '?'}, ${this.getAttribute('theme') ?? '?'} theme.`;
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Open members';
    open.addEventListener('click', () =>
      this.dispatchEvent(
        new CustomEvent(NAVIGATE_EVENT, {
          bubbles: true,
          composed: true,
          detail: { to: membersPath(this.getAttribute('workspace') ?? '') },
        }),
      ),
    );

    section.append(heading, detail, open);
    this.#root.replaceChildren(style, section);
  }
}

if (!customElements.get(ELEMENT)) {
  customElements.define(ELEMENT, DemoSettingsPage);
}

const meta = {
  title: 'Settings/Workspace/Extra page',
  ...pageStory({
    at: extraSettingsPath(SLUG, 'demo'),
    world: () => {
      settingsWorld().extraPages = [
        {
          id: 'demo',
          label: 'Demo',
          group: 'workspace',
          roles: ['owner', 'admin'],
          script: '/demo/element.js',
          element: ELEMENT,
        },
      ];
    },
  }),
} satisfies Meta<PageArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Page: Story = {};
