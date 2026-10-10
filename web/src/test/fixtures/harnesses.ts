import type { HarnessResponseDto } from '@/lib/api';

const harness = (id: string, name: string): HarnessResponseDto => ({
  id,
  name,
  models: [],
  defaultModel: '',
  efforts: [],
});

export const HARNESSES: HarnessResponseDto[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [{ id: 'claude-opus-5', name: 'Opus 5' }],
    defaultModel: 'claude-opus-5',
    efforts: ['low', 'medium', 'high'],
  },
  harness('cursor', 'Cursor'),
  harness('codex', 'Codex'),
  harness('gemini', 'Gemini CLI'),
];
