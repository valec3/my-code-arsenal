import axios, { type AxiosInstance } from 'axios';
import { isRetryable, retryDelayMs, toSeiriError } from './errors';

export interface JiraConnectionConfig {
  host: string;
  email: string;
  apiToken: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

export class JiraHttpClient {
  private readonly http: AxiosInstance;
  private readonly agile: AxiosInstance;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(config: JiraConnectionConfig) {
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const host = normalizeHost(config.host);
    const timeout = config.timeoutMs ?? 15000;
    const headers = {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    this.http = axios.create({ baseURL: `${host}/rest/api/3`, timeout, headers });
    this.agile = axios.create({ baseURL: `${host}/rest/agile/1.0`, timeout, headers });

    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 300;
  }

  get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>(() => this.http.get<T>(path, { params }), true);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(() => this.http.post<T>(path, body), false);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(() => this.http.put<T>(path, body), true);
  }

  delete(path: string): Promise<void> {
    return this.request<void>(() => this.http.delete(path), true);
  }

  agileGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>(() => this.agile.get<T>(path, { params }), true);
  }

  agilePost<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(() => this.agile.post<T>(path, body), false);
  }

  agilePut<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(() => this.agile.put<T>(path, body), true);
  }

  private async request<T>(
    operation: () => Promise<{ data: T }>,
    allowServerErrors: boolean
  ): Promise<T> {
    let attempt = 0;

    for (;;) {
      try {
        const response = await operation();
        return response.data;
      } catch (error) {
        if (!isRetryable(error, allowServerErrors) || attempt >= this.maxRetries) {
          throw toSeiriError(error);
        }

        await sleep(retryDelayMs(error, attempt, this.baseDelayMs));
        attempt += 1;
      }
    }
  }
}

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
