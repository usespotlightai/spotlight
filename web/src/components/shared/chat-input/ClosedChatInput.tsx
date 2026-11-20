import type { ReactNode } from 'react';

import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ClosedChatInputProps = {
  slug: string;
  label: string;
  placeholder: string;
  because: string;
  settings: ReactNode;
  below?: ReactNode;
};

export function ClosedChatInput({
  slug,
  label,
  placeholder,
  because,
  settings,
  below,
}: ClosedChatInputProps) {
  return (
    <Tooltip>
      <TooltipTrigger delay={0} render={<div data-slot="closed-chat-input" />}>
        <ChatInput
          disabled
          slug={slug}
          label={label}
          placeholder={placeholder}
          settings={settings}
          below={below}
        />
        <span className="sr-only">{because}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {because}
      </TooltipContent>
    </Tooltip>
  );
}
