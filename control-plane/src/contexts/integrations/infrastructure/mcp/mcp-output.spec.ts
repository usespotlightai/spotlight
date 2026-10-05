import { mcpOutput } from '@integrations/infrastructure/mcp/mcp-output';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { describe, expect, it } from 'vitest';

const text = (said: string) => ({ type: 'text' as const, text: said });

describe('mcpOutput', () => {
  it('answers with the structured content when there is some', () => {
    expect(
      mcpOutput(
        { content: [text('ENG-1')], structuredContent: { id: 'ENG-1' } },
        'tracker.search',
      ),
    ).toEqual({ id: 'ENG-1' });
  });

  it('answers with a lone text as JSON when it reads as JSON, and as text when not', () => {
    expect(
      mcpOutput({ content: [text('{"deleted":"ENG-1"}')] }, 'tracker.delete'),
    ).toEqual({ deleted: 'ENG-1' });
    expect(mcpOutput({ content: [text('Deleted.')] }, 'tracker.delete')).toBe(
      'Deleted.',
    );
  });

  it('answers with the whole content when it is more than one text', () => {
    expect(
      mcpOutput(
        {
          content: [
            text('one'),
            { type: 'image', data: 'aGk=', mimeType: 'image/png' },
          ],
        },
        'tracker.show',
      ),
    ).toEqual([
      { type: 'text', text: 'one' },
      { type: 'image', data: 'aGk=', mimeType: 'image/png' },
    ]);
  });

  it('refuses with what the server said when it answers with an error', () => {
    const refusing = () =>
      mcpOutput(
        { isError: true, content: [text('Deleting is frozen.')] },
        'tracker.delete',
      );

    expect(refusing).toThrow(UpstreamRefusedError);
    expect(() => refusing()).toThrow(
      expect.objectContaining({ retryable: false }),
    );
    expect(refusing).toThrow(
      'using tracker.delete: the MCP server answered with an error: Deleting is frozen.',
    );
  });
});
