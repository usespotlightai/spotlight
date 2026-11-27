import { useSendOnEnter } from '@/hooks/useSendOnEnter';

type SendOnEnterProps = {
  send: () => void;
  blank: boolean;
};

export function SendOnEnter({ send, blank }: SendOnEnterProps): null {
  useSendOnEnter(send, blank);

  return null;
}
