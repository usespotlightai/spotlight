import { useEffect } from 'react';

import { reportAs } from '@/lib/error-reporting';

export function useErrorReportsAs(userId: string | null) {
  useEffect(() => reportAs(userId), [userId]);
}
