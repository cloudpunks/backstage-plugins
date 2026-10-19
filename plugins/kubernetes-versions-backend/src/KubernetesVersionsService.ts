import { LoggerService } from '@backstage/backend-plugin-api';
import { RefreshingCache } from './RefreshingCache';
import {
  Distribution,
  GithubRelease,
  k0sReleasesUrl,
  kubernetesPackagesUrl,
  kubernetesStableUrl,
  MinorVersion,
  newestK0sVersions,
  newestPackageVersion,
  oldestK0sMinor,
  parseK0sVersion,
  stableMinor,
  SupportedMinors,
  supportedMinorList,
} from './versions';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 10_000;
const missingStatus = [403, 404];

export type KubernetesVersionsServiceOptions = {
  logger: LoggerService;
  supportedMinors: number;
  fetch?: typeof fetch;
  now?: () => number;
};

// lists the newest release of the supported minors, counted down from the
// minor of the newest stable kubernetes release. Kubernetes releases come from
// the apt repository the nodes install from, k0s releases from github.
// Without a token github only allows 60 requests per hour and ip address, so
// everything is cached for eight hours, and the last loaded values are served
// if a source can't be reached
export class KubernetesVersionsService {
  readonly #supportedMinors: number;
  readonly #fetch: typeof fetch;
  readonly #latestMinor: RefreshingCache<number>;
  readonly #packages: RefreshingCache<string | null>;
  readonly #releases: RefreshingCache<GithubRelease[]>;

  constructor(options: KubernetesVersionsServiceOptions) {
    this.#supportedMinors = options.supportedMinors;
    this.#fetch = options.fetch ?? fetch;
    this.#latestMinor = new RefreshingCache(options);
    this.#packages = new RefreshingCache(options);
    this.#releases = new RefreshingCache(options);
  }

  async list(distribution: Distribution): Promise<MinorVersion[]> {
    const minors: SupportedMinors = {
      latestMinor: await this.latestMinor(),
      supportedMinors: this.#supportedMinors,
    };

    if (distribution === 'kubernetes') {
      return this.#kubernetesVersions(minors);
    }

    const releases = await this.#releases.get(
      'k0s',
      'fetch the k0s releases',
      () => this.#fetchK0sReleases(oldestK0sMinor(minors)),
    );
    return newestK0sVersions(releases, minors);
  }

  async latestMinor(): Promise<number> {
    return this.#latestMinor.get(
      'stable',
      'read the stable kubernetes release',
      async () => {
        const response = await this.#request(kubernetesStableUrl);
        return stableMinor(await response.text());
      },
    );
  }

  // minors without a published apt repository yet are left out, the CDN
  // answers them with 403
  async #kubernetesVersions(minors: SupportedMinors): Promise<MinorVersion[]> {
    const versions = await Promise.all(
      supportedMinorList(minors).map(async minor => ({
        minor: `1.${minor}`,
        version: await this.#packages.get(
          `1.${minor}`,
          `fetch the kubernetes 1.${minor} packages`,
          async () => {
            const response = await this.#request(kubernetesPackagesUrl(minor), {
              allowMissing: true,
            });
            return missingStatus.includes(response.status)
              ? null
              : (newestPackageVersion(await response.text()) ?? null);
          },
        ),
      })),
    );

    return versions.filter(
      (entry): entry is MinorVersion => entry.version !== null,
    );
  }

  // github lists the releases newest first, older pages can be skipped once a
  // page only contains releases below the oldest considered minor
  async #fetchK0sReleases(oldest: number): Promise<GithubRelease[]> {
    const releases: GithubRelease[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await this.#request(
        `${k0sReleasesUrl}?per_page=${PAGE_SIZE}&page=${page}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      const pageReleases = (await response.json()) as GithubRelease[];
      releases.push(...pageReleases);

      const minors = pageReleases
        .map(release => parseK0sVersion(release.tag_name)?.minor)
        .filter((minor): minor is number => minor !== undefined);
      const onlyOlderReleases =
        minors.length > 0 && minors.every(minor => minor < oldest);

      if (pageReleases.length < PAGE_SIZE || onlyOlderReleases) {
        break;
      }
    }

    return releases;
  }

  async #request(
    url: string,
    options: { headers?: Record<string, string>; allowMissing?: boolean } = {},
  ): Promise<Response> {
    const response = await this.#fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (
      !response.ok &&
      !(options.allowMissing && missingStatus.includes(response.status))
    ) {
      throw new Error(
        `${url} responded with ${response.status} ${response.statusText}`,
      );
    }
    return response;
  }
}
