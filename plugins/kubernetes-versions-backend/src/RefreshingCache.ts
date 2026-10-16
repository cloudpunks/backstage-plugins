import { LoggerService } from '@backstage/backend-plugin-api';
import { ServiceUnavailableError } from '@backstage/errors';

// releases come out every few weeks, a new one may show up hours later
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;
// after a failed load the source is left alone for a while, e.g. while
// github rate limits the requests
const RETRY_DELAY_MS = 5 * 60 * 1000;

type Entry<T> = {
  value: T;
  loadedAt: number;
};

type Failure = {
  error: Error;
  failedAt: number;
};

// keeps loaded values for eight hours. Concurrent calls share one load. If a
// load fails, the last loaded value is served and no new load is started for
// five minutes
export class RefreshingCache<T> {
  readonly #logger: LoggerService;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry<T>>();
  readonly #failures = new Map<string, Failure>();
  readonly #pending = new Map<string, Promise<T>>();

  constructor(options: { logger: LoggerService; now?: () => number }) {
    this.#logger = options.logger;
    this.#now = options.now ?? Date.now;
  }

  async get(
    key: string,
    description: string,
    load: () => Promise<T>,
  ): Promise<T> {
    const entry = this.#entries.get(key);
    if (entry && this.#now() - entry.loadedAt < CACHE_TTL_MS) {
      return entry.value;
    }

    const failure = this.#failures.get(key);
    if (failure && this.#now() - failure.failedAt < RETRY_DELAY_MS) {
      return this.#fallback(key, description, failure.error);
    }

    let pending = this.#pending.get(key);
    if (!pending) {
      pending = this.#load(key, description, load).finally(() =>
        this.#pending.delete(key),
      );
      this.#pending.set(key, pending);
    }

    return pending;
  }

  async #load(
    key: string,
    description: string,
    load: () => Promise<T>,
  ): Promise<T> {
    try {
      const value = await load();
      this.#entries.set(key, { value, loadedAt: this.#now() });
      this.#failures.delete(key);
      return value;
    } catch (error) {
      this.#failures.set(key, {
        error: error as Error,
        failedAt: this.#now(),
      });
      this.#logger.warn(`Failed to ${description}`, error as Error);
      return this.#fallback(key, description, error as Error);
    }
  }

  #fallback(key: string, description: string, error: Error): T {
    const entry = this.#entries.get(key);
    if (entry) {
      return entry.value;
    }
    throw new ServiceUnavailableError(`Failed to ${description}`, error);
  }
}
