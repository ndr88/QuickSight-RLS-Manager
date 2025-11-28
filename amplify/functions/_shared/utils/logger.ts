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

  constructor(functionName: string, context?: LogContext) {
    this.context = {
      functionName,
      ...context
    };
  }

  private log(level: LogLevel, message: string, data?: any) {
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
