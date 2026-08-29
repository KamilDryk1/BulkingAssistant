import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';
import { createContext, use, useEffect, useMemo, useState } from 'react';

import { fetchProfile } from '@/features/profile/profile-service';
import { profileKeys } from '@/features/profile/profile-queries';
import { getCurrentLocale, setAppLocale } from '@/i18n';
import { env } from '@/lib/env';
import { supabase } from '@/services/supabase/client';
import type { ProfileRow } from '@/types/database';

type AuthContextValue = {
  configured: boolean;
  isLoading: boolean;
  profile: ProfileRow | null;
  profileError: Error | null;
  refreshProfile: () => Promise<void>;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(env.supabase.configured);
  const userId = session?.user.id;
  const profileQuery = useQuery({
    enabled: Boolean(userId && supabase),
    queryFn: () => fetchProfile(userId!),
    queryKey: userId ? profileKeys.detail(userId) : profileKeys.all,
    retry: 1,
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setSessionLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      queryClient.removeQueries({ queryKey: profileKeys.all });
    }
  }, [queryClient, session]);

  useEffect(() => {
    const profileLocale = profileQuery.data?.locale;
    if (profileLocale && profileLocale !== getCurrentLocale()) {
      void setAppLocale(profileLocale);
    }
  }, [profileQuery.data?.locale]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: env.supabase.configured,
      isLoading: sessionLoading || (Boolean(session) && profileQuery.isPending),
      profile: profileQuery.data ?? null,
      profileError: profileQuery.error,
      refreshProfile: async () => {
        await profileQuery.refetch();
      },
      session,
      user: session?.user ?? null,
    }),
    [profileQuery, session, sessionLoading],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
