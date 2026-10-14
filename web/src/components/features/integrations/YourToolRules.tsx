import { ToolRuleSelect } from '@/components/features/integrations/ToolRuleSelect';
import { useSetToolRule } from '@/hooks/api/useSetToolRule';
import type { ConnectionToolRuleResponseDto } from '@/lib/api';

type YourToolRulesProps = {
  teamId: string;
  source: string;
  tools: readonly ConnectionToolRuleResponseDto[];
};

const named = (source: string, tool: string): string =>
  tool.startsWith(`${source}.`) ? tool.slice(source.length + 1) : tool;

export function YourToolRules({ teamId, source, tools }: YourToolRulesProps) {
  const setting = useSetToolRule(teamId);

  return (
    <ul
      aria-label={`What may act as you in ${source}`}
      className="-my-0.5 -mr-2 flex flex-col"
    >
      {tools.map((each) => (
        <li
          key={each.tool}
          className="flex min-h-7 items-center justify-between gap-4"
        >
          <span className="truncate text-foreground text-sm">
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
