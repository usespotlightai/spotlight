import { DetailProperty } from '@/components/features/trace/view/detail/DetailProperty';
import { holdings, reported } from '@/lib/detail';
import { counted, spentOn, spokenAt, took } from '@/lib/inbox';
import type { TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const tokensOf = (node: TraceNode): string | null => {
  const all = [
    reported(node, 'gen_ai.usage.input_tokens', 'gen_ai.usage.prompt_tokens'),
    reported(
      node,
      'gen_ai.usage.output_tokens',
      'gen_ai.usage.completion_tokens',
    ),
  ].reduce((sum, each) => sum + (Number(each) || 0), 0);

  return all > 0 ? counted(all) : null;
};

export function DetailHeader({ node }: { node: TraceNode }) {
  const held = holdings(node);
  const model = reported(node, 'gen_ai.request.model', 'llm.model_name');
  const tokens = tokensOf(node);

  return (
    <div className="flex flex-col gap-3">
      <h2
        className={cn(
          'min-w-0 break-words font-medium text-sm leading-5',
          node.tone === 'failed' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {node.name}
      </h2>

      <dl className="flex flex-col">
        <DetailProperty name="Started">
          {spokenAt(node.startedAt)}
        </DetailProperty>
        <DetailProperty name="Took">{took(node.ms)}</DetailProperty>

        {node.step?.status && (
          <DetailProperty name="Status" failed={node.step.status === 'failed'}>
            {node.step.status}
          </DetailProperty>
        )}
        {node.step?.tool && (
          <DetailProperty name="Tool">{node.step.tool}</DetailProperty>
        )}
        {model && <DetailProperty name="Model">{model}</DetailProperty>}
        {tokens && <DetailProperty name="Tokens">{tokens}</DetailProperty>}
        {node.cost !== null && (
          <DetailProperty name="Cost">{spentOn(node.cost)}</DetailProperty>
        )}
        {held.rows > 0 && (
          <DetailProperty name="Rows">{held.rows}</DetailProperty>
        )}
        {held.faults > 0 && (
          <DetailProperty name="Faults" failed>
            {held.faults}
          </DetailProperty>
        )}
      </dl>
    </div>
  );
}
