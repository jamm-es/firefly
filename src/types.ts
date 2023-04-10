export interface DeviceInfo {
  browser: string
}

export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface ConsoleLog {
  level: LogLevel,
  timestamp: Date,
  message: string,
}

export interface NetworkLog {
  sentWith: 'XMLHttpRequest' | 'fetch',
  activityState: 'not started' | 'started' | 'done' | 'aborted' | 'errored' | 'timed out',
  url: string,
  method: string,
  status: number,
  startTime: Date | null,
  endTime: Date | null,
  responseHeaders: {[key: string]: string},
  requestHeaders: {[key: string]: string},
  requestBody: string
}
