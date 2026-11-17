import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { setResponseHeader } from '@tanstack/react-start/server';
import type { Database } from '@/integrations/supabase/types';
import { validShareToken, type SharedGroup } from './sharing';

export const readSharedGroup = createServerFn({ method: 'GET' })
  .inputValidator((input: { token: string }) => {
    if (!validShareToken(input.token)) throw new Error('קישור לא תקין');
    return input;
  })
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const url = process.env['SUPABASE_URL'];
    if (!key || !url) throw new Error('לא ניתן לטעון את הקבוצה');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await client.rpc('read_shared_group', { share_token: data.token });
    if (result.error) throw new Error('לא ניתן לטעון את הקבוצה');
    return result.data as unknown as SharedGroup | null;
  });