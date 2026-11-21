import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReferenceIcon } from '@/components/shared/chat-input/ReferenceIcon';
import type { Reference } from '@/lib/chat-input';

const iconClassOf = (name: string): string | undefined => {
  const reference: Reference = { kind: 'file', key: name, name };
  const { container } = render(<ReferenceIcon reference={reference} />);
  return container.querySelector('svg')?.getAttribute('class') ?? undefined;
};

describe('ReferenceIcon', () => {
  it.each([
    ['clip.MOV', 'lucide-file-video'],
    ['song.mp3', 'lucide-file-audio'],
    ['photo.png', 'lucide-image'],
    ['bundle.tar', 'lucide-file-archive'],
    ['sheet.xlsx', 'lucide-file-spreadsheet'],
    ['config.yaml', 'lucide-file-json'],
    ['server.log', 'lucide-scroll-text'],
    ['deploy.sh', 'lucide-terminal'],
    ['schema.sql', 'lucide-database'],
    ['main.ts', 'lucide-braces'],
    ['report.pdf', 'lucide-file-text'],
  ])('shows the icon of %s', (name, expected) => {
    expect(iconClassOf(name)).toContain(expected);
  });

  it.each(['constructor', 'toString', 'log', 'json'])(
    'shows the plain file icon for the name %s with no extension',
    (name) => {
      expect(iconClassOf(name)).toContain('lucide-file-text');
    },
  );
});
