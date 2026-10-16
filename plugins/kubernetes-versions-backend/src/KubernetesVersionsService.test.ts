import { mockServices } from '@backstage/backend-test-utils';
import { KubernetesVersionsService } from './KubernetesVersionsService';

function packages(version: string) {
  return ['kubelet', 'kubeadm', 'kubectl']
    .map(
      name =>
        `Package: ${name}\nVersion: ${version}-1.1\nArchitecture: amd64\n`,
    )
    .join('\n');
}

function releasesResponse(tags: string[]) {
  return new Response(
    JSON.stringify(
      tags.map(tag => ({ tag_name: tag, draft: false, prerelease: false })),
    ),
  );
}

// answers the stable release and the apt repositories, every github api
// request gets the next release page
function mockFetch(
  options: {
    stable?: string;
    repositories?: Record<string, string>;
    releasePages?: Response[];
  } = {},
) {
  const repositories = options.repositories ?? {};
  const releasePages = [...(options.releasePages ?? [])];

  return jest.fn(async (url: string, _init?: RequestInit) => {
    if (url === 'https://dl.k8s.io/release/stable.txt') {
      return new Response(`${options.stable ?? 'v1.36.5'}\n`);
    }
    const repository =
      /^https:\/\/pkgs\.k8s\.io\/core:\/stable:\/(v1\.\d+)\//.exec(url);
    if (repository) {
      const content = repositories[repository[1]];
      return content === undefined
        ? new Response('', { status: 403, statusText: 'Forbidden' })
        : new Response(content);
    }
    const page = releasePages.shift();
    if (!page) {
      throw new Error(`Unexpected request ${url}`);
    }
    return page;
  });
}

function createService(fetch: jest.Mock) {
  return new KubernetesVersionsService({
    logger: mockServices.logger.mock(),
    supportedMinors: 3,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
}

describe('KubernetesVersionsService', () => {
  it('reads the newest minor from the stable kubernetes release', async () => {
    const fetch = mockFetch({ stable: 'v1.37.1' });

    await expect(createService(fetch).latestMinor()).resolves.toBe(37);
    expect(fetch).toHaveBeenCalledWith(
      'https://dl.k8s.io/release/stable.txt',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('offers the newest kubernetes packages of the three newest minors', async () => {
    const fetch = mockFetch({
      stable: 'v1.37.1',
      repositories: {
        'v1.37': packages('1.37.1'),
        'v1.36': packages('1.36.5'),
        'v1.35': packages('1.35.9'),
        'v1.34': packages('1.34.12'),
      },
    });

    await expect(createService(fetch).list('kubernetes')).resolves.toEqual([
      { minor: '1.37', version: 'v1.37.1' },
      { minor: '1.36', version: 'v1.36.5' },
      { minor: '1.35', version: 'v1.35.9' },
    ]);
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('v1.34'),
      expect.anything(),
    );
  });

  it('leaves out minors without a published apt repository', async () => {
    const fetch = mockFetch({
      repositories: { 'v1.35': packages('1.35.9'), 'v1.34': '' },
    });

    await expect(createService(fetch).list('kubernetes')).resolves.toEqual([
      { minor: '1.35', version: 'v1.35.9' },
    ]);
  });

  it('offers the newest k0s releases, even if k0s lags behind', async () => {
    const fetch = mockFetch({
      stable: 'v1.37.1',
      releasePages: [
        releasesResponse([
          'v1.36.4+k0s.1',
          'v1.35.8+k0s.1',
          'v1.34.11+k0s.1',
          'v1.33.15+k0s.0',
        ]),
      ],
    });

    await expect(createService(fetch).list('k0s')).resolves.toEqual([
      { minor: '1.36', version: 'v1.36.4+k0s.1' },
      { minor: '1.35', version: 'v1.35.8+k0s.1' },
      { minor: '1.34', version: 'v1.34.11+k0s.1' },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/k0sproject/k0s/releases?per_page=100&page=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reads further k0s release pages until only older minors are left', async () => {
    const page = (tag: string) =>
      releasesResponse(Array.from({ length: 100 }, () => tag));
    const fetch = mockFetch({
      releasePages: [
        page('v1.36.5+k0s.0'),
        page('v1.34.1+k0s.0'),
        page('v1.33.1+k0s.0'),
        page('v1.32.1+k0s.0'),
      ],
    });

    await expect(createService(fetch).list('k0s')).resolves.toEqual([
      { minor: '1.36', version: 'v1.36.5+k0s.0' },
      { minor: '1.34', version: 'v1.34.1+k0s.0' },
      { minor: '1.33', version: 'v1.33.1+k0s.0' },
    ]);
    expect(
      fetch.mock.calls.filter(([url]) => url.startsWith('https://api.github')),
    ).toHaveLength(4);
  });

  it('fails if github can not be reached', async () => {
    const fetch = mockFetch({
      releasePages: [
        new Response('rate limited', { status: 403, statusText: 'Forbidden' }),
      ],
    });

    await expect(createService(fetch).list('k0s')).rejects.toThrow(
      'Failed to fetch the k0s releases',
    );
  });

  it('fails if the stable release can not be read', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(createService(fetch).list('kubernetes')).rejects.toThrow(
      'Failed to read the stable kubernetes release',
    );
  });
});
