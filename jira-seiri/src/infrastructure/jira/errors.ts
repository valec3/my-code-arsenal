import axios from 'axios';
import { SeiriError } from '../../domain/errors';
import type { JiraErrorDto } from './dto';

export function toSeiriError(error: unknown): SeiriError {
  if (error instanceof SeiriError) {
    return error;
  }

  if (!axios.isAxiosError(error)) {
    return new SeiriError(error instanceof Error ? error.message : String(error), 'JIRA');
  }

  if (!error.response) {
    return new SeiriError(`Error de red hacia Jira: ${error.message}`, 'JIRA');
  }

  const { status, data } = error.response;
  const payload = (data ?? {}) as JiraErrorDto;
  const details = [
    ...(payload.errorMessages ?? []),
    ...Object.entries(payload.errors ?? {}).map(([field, message]) => `${field}: ${message}`),
  ];
  const suffix = details.length > 0 ? `: ${details.join('; ')}` : '';

  return new SeiriError(`Jira respondio HTTP ${status}${suffix}`, 'JIRA');
}

export function isRetryable(error: unknown, allowServerErrors: boolean): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return allowServerErrors;
  }

  const status = error.response.status;
  if (status === 429) {
    return true;
  }

  return allowServerErrors && status >= 500;
}

export function retryDelayMs(error: unknown, attempt: number, baseDelayMs: number): number {
  if (axios.isAxiosError(error)) {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter !== undefined) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) {
        return Math.max(0, seconds * 1000);
      }
    }
  }

  return Math.min(baseDelayMs * 2 ** attempt, 8000);
}
