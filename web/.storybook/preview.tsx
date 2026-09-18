import type { Preview } from '@storybook/react-vite';
import { onlineManager } from '@tanstack/react-query';
import { sb } from 'storybook/test';
import '../src/index.css';

sb.mock(import('../src/hooks/api/useSession.ts'));

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach: () => {
    onlineManager.setOnline(false);

    return () => onlineManager.setOnline(true);
  },
};

export default preview;
