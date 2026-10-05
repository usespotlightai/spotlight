import { ToolRuleSelect } from '@/components/features/connections/ToolRuleSelect';
import { useSetToolRule } from '@/hooks/api/useSetToolRule';
import type { ConnectionToolRuleResponseDto } from '@/lib/api';

type ConnectionToolsProps = {
  teamId: string;
  source: string;
  tools: readonly ConnectionToolRuleResponseDto[];
};

const named = (source: string, tool: string): string =>
  tool.startsWith(`${source}.`) ? tool.slice(source.length + 1) : tool;

export function ConnectionTools({
  teamId,
  source,
  tools,
}: ConnectionToolsProps) {
  const setting = useSetToolRule(teamId);

  if (tools.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={`Your rules for ${source}`}
      className="flex flex-col pr-4 pb-2 pl-14"
    >
      {tools.map((each) => (
        <li
          key={each.tool}
          className="flex min-h-8 items-center justify-between gap-4"
        >
          <span className="truncate font-mono text-muted-foreground text-xs">
            {named(source, each.tool)}
          </span>
          <ToolRuleSelect
            tool={each.tool}
            rule={each.rule}
            disabled={setting.isPending}
            onRule={(rule) => setting.mutate({ source, tool: each.tool, rule })}
          />
        </li>
      ))}
      {setting.isError && (
        <li role="alert" className="text-destructive text-xs">
          Could not set that rule. Try again.
        </li>
      )}
    </ul>
  );
}
