import { useEffect } from 'react';
import type { Location } from 'react-router';
import { userEvent, within } from 'storybook/test';
import { MockApplication } from '@/stories/MockApplication';

type Screen = ReturnType<typeof within>;

export type Script = (screen: Screen, user: typeof userEvent) => Promise<void>;

type ScriptedApplicationProps = {
  at: string | Partial<Location>;
  script?: Script;
};

export function ScriptedApplication({ at, script }: ScriptedApplicationProps) {
  useEffect(() => {
    void script?.(within(document.body), userEvent);
  }, [script]);

  return <MockApplication at={at} />;
}
