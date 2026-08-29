import { useEffect, useState } from 'react';

import { getLocalDateKey } from '@/features/training/training-domain';

export function useCurrentDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return { date: now, dateKey: getLocalDateKey(now) };
}
