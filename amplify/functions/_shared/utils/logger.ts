/**
 * Structured logging utility for Lambda functions
 * Provides consistent logging with levels and context
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogContext {
  functionName?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(functionName: string, context?: LogContext) {
    this.context = {
      functionName,
      ...context
    };
    // Get log level from environment variable, default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    this.minLevel = envLevel || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    return currentLevelIndex >= minLevelIndex;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) {
      return;
    }
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...(data && { data })
    };

    const output = JSON.stringify(logEntry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any) {
    const errorData = error instanceof Error 
      ? { 
          errorName: error.name, 
          errorMessage: error.message, 
          stack: error.stack 
        }
      : error;
    
    this.log(LogLevel.ERROR, message, errorData);
  }

  addContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }
}

export function createLogger(functionName: string, context?: LogContext): Logger {
  return new Logger(functionName, context);
}
