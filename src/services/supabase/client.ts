import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

class StaticRenderWebSocket {
  readonly CLOSED = 3;
  readonly CLOSING = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly protocol = '';
  readonly readyState = this.CLOSED;
  readonly url: string;
  onclose: WebSocket['onclose'] = null;
  onerror: WebSocket['onerror'] = null;
  onmessage: WebSocket['onmessage'] = null;
  onopen: WebSocket['onopen'] = null;

  constructor(address: string | URL) {
    this.url = String(address);
  }

  addEventListener(_type: string, _listener: EventListener) {}

  close() {}

  removeEventListener(_type: string, _listener: EventListener) {}

  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
}

const isStaticWebRender = process.env.EXPO_OS === 'web' && typeof window === 'undefined';

export const supabase = env.supabase.configured
  ? createClient<Database>(env.supabase.url, env.supabase.key, {
      auth: {
        ...(process.env.EXPO_OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
      ...(isStaticWebRender ? { realtime: { transport: StaticRenderWebSocket } } : {}),
    })
  : null;

if (supabase && process.env.EXPO_OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
