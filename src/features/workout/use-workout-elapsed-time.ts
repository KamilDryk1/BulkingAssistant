import { useEffect, useState } from 'react';

import { formatElapsedTime, getElapsedSeconds } from './workout-domain';

export function useWorkoutElapsedTime(startedAt: string, completedAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (completedAt) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [completedAt]);

  return formatElapsedTime(getElapsedSeconds(startedAt, completedAt, now));
}
