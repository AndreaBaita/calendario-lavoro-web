import { createClient } from '@supabase/supabase-js';

export default async function handler(_request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return response.status(500).json({ ok: false });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await supabase.from('profiles').select('id').limit(1);

    if (error) {
      throw error;
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Supabase keep-alive failed:', error);
    return response.status(500).json({ ok: false });
  }
}
