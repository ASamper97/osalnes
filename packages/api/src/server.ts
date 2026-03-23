import { app } from './app.js';
import { env } from './config/env.js';
import { supabase } from './db/supabase.js';

async function main() {
  // Verify Supabase connection
  try {
    const { error } = await supabase.from('municipio').select('id').limit(1);
    if (error) throw error;
    console.log('[db] Supabase connected');
  } catch (err) {
    console.error('[db] Supabase connection failed:', err);
    console.error('[db] Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  app.listen(env.port, env.host, () => {
    console.log(`[api] DTI Salnes API running on http://${env.host}:${env.port}`);
    console.log(`[api] REST  -> /api/v1`);
    console.log(`[api] Admin -> /api/v1/admin`);
    console.log(`[api] GraphQL -> /graphql`);
    console.log(`[api] Supabase -> ${env.supabaseUrl}`);
  });
}

main();
