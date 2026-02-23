type LogLevel = 'info' | 'warn' | 'error';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string): void {
  console.log(`[${formatTimestamp()}] [${level.toUpperCase()}] [${context}] ${message}`);
}

export const logger = {
  info: (context: string, message: string) => log('info', context, message),
  warn: (context: string, message: string) => log('warn', context, message),
  error: (context: string, message: string) => log('error', context, message),
};
