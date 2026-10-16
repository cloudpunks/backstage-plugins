import { mockServices } from '@backstage/backend-test-utils';
import { RefreshingCache } from './RefreshingCache';

const minutes = (count: number) => count * 60 * 1000;

function createCache(now: () => number = () => 0) {
  return new RefreshingCache<string>({
    logger: mockServices.logger.mock(),
    now,
  });
}

const failing = () =>
  jest.fn(async (): Promise<string> => {
    throw new Error('network down');
  });

describe('RefreshingCache', () => {
  it('keeps a loaded value for eight hours', async () => {
    let time = 0;
    const cache = createCache(() => time);
    const load = jest
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    await expect(cache.get('key', 'load', load)).resolves.toBe('first');
    time = minutes(8 * 60 - 1);
    await expect(cache.get('key', 'load', load)).resolves.toBe('first');
    time = minutes(8 * 60 + 1);
    await expect(cache.get('key', 'load', load)).resolves.toBe('second');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the values of different keys apart', async () => {
    const cache = createCache();

    await cache.get('a', 'load', async () => 'a');

    await expect(cache.get('b', 'load', async () => 'b')).resolves.toBe('b');
  });

  it('shares one load between concurrent calls', async () => {
    const cache = createCache();
    const load = jest.fn().mockResolvedValue('value');

    await Promise.all([
      cache.get('key', 'load', load),
      cache.get('key', 'load', load),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves the last loaded value if a reload fails', async () => {
    let time = 0;
    const cache = createCache(() => time);

    await cache.get('key', 'load', async () => 'value');
    time = minutes(9 * 60);

    await expect(cache.get('key', 'load', failing())).resolves.toBe('value');
  });

  it('fails if nothing was loaded before', async () => {
    const cache = createCache();

    await expect(cache.get('key', 'load the value', failing())).rejects.toThrow(
      'Failed to load the value',
    );
  });

  it('waits five minutes after a failed load before loading again', async () => {
    let time = 0;
    const cache = createCache(() => time);
    const load = failing();

    await expect(cache.get('key', 'load', load)).rejects.toThrow();
    time = minutes(4);
    await expect(cache.get('key', 'load', load)).rejects.toThrow(
      'Failed to load',
    );
    expect(load).toHaveBeenCalledTimes(1);

    time = minutes(6);
    await expect(cache.get('key', 'load', async () => 'value')).resolves.toBe(
      'value',
    );
  });

  it('serves the last loaded value while waiting after a failed reload', async () => {
    let time = 0;
    const cache = createCache(() => time);
    const load = failing();

    await cache.get('key', 'load', async () => 'value');
    time = minutes(8 * 60 + 1);
    await cache.get('key', 'load', load);
    time = minutes(8 * 60 + 3);

    await expect(cache.get('key', 'load', load)).resolves.toBe('value');
    expect(load).toHaveBeenCalledTimes(1);
  });
});
