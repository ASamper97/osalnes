import { app } from './app.js';
import { env } from './config/env.js';
import { supabase } from './db/supabase.js';
import { logger } from './lib/logger.js';

async function main() {
  // Verify Supabase connection
  try {
    const { error } = await supabase.from('municipio').select('id').limit(1);
    if (error) throw error;
    logger.info('Supabase connected', { url: env.supabaseUrl });
  } catch (err) {
    logger.error('Supabase connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    logger.error('Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  app.listen(env.port, env.host, () => {
    logger.info('DTI Salnés API started', {
      host: env.host,
      port: env.port,
      endpoints: {
        rest: '/api/v1',
        admin: '/api/v1/admin',
        graphql: '/graphql',
      },
    });
  });
}

main();
