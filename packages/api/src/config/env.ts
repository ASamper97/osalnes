import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

export const env = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  host: process.env.API_HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(','),
  meiliHost: process.env.MEILI_HOST || 'http://localhost:7700',
  meiliMasterKey: process.env.MEILI_MASTER_KEY || '',
  pidDtiCode: process.env.PID_DTI_CODE || 'osalnes',
} as const;
