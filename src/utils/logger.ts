import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

export type Logger = Pick<PinoLogger, 'debug' | 'info' | 'warn' | 'error' | 'child'>;

const defaultOptions: LoggerOptions = {
  level: process.env.SPECBRIDGE_LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'specbridge',
  },
};

const destination = pino.destination({
  fd: 2, // stderr
  sync: false,
});

const rootLogger = pino(defaultOptions, destination);

export function getLogger(bindings?: Record<string, unknown>): Logger {
  if (!bindings) {
    return rootLogger;
  }
  return rootLogger.child(bindings);
}

export const logger = getLogger();
