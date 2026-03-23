/**
 * Structured logger for the DTI Salnés API.
 * Outputs JSON in production, readable format in development.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? 1;
const IS_PROD = process.env.NODE_ENV === 'production';

function emit(entry: LogEntry) {
  if (LOG_LEVELS[entry.level] < MIN_LEVEL) return;

  if (IS_PROD) {
    // Structured JSON for log aggregators
    const stream = entry.level === 'error' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  } else {
    // Human-readable for development
    const prefix = `[${entry.level.toUpperCase()}]`;
    const extra = Object.entries(entry)
      .filter(([k]) => !['level', 'message', 'timestamp'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    const line = `${prefix} ${entry.message}${extra ? ' ' + extra : ''}`;
    if (entry.level === 'error') {
      console.error(line);
    } else if (entry.level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

function createLog(level: LogLevel) {
  return (message: string, meta?: Record<string, unknown>) => {
    emit({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  };
}

export const logger = {
  debug: createLog('debug'),
  info: createLog('info'),
  warn: createLog('warn'),
  error: createLog('error'),
};
