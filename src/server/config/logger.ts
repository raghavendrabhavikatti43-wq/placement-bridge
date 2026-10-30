import pino from 'pino';

export function scrubConnectionUris(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, 'postgresql://[REDACTED]');
}

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'DATABASE_URL',
      'databaseUrl',
      'connectionString',
      'password',
      'passwordHash',
      'refreshToken',
      'refreshTokenHash',
      'token',
      'apiKey',
      'body.password',
      'body.currentPassword',
      'body.newPassword',
    ],
    censor: '[REDACTED]',
  },
});
