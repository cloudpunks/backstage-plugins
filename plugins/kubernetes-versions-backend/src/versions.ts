export type Distribution = 'kubernetes' | 'k0s';

export function isDistribution(name: string): name is Distribution {
  return name === 'kubernetes' || name === 'k0s';
}

export type SupportedMinors = {
  latestMinor: number;
  supportedMinors: number;
};

export type MinorVersion = {
  minor: string;
  version: string;
};

// the newest stable kubernetes release, e.g. v1.37.1. Kubernetes maintains
// the three newest minors
export const kubernetesStableUrl = 'https://dl.k8s.io/release/stable.txt';

export function stableMinor(stable: string): number {
  const match = /^v1\.(\d+)\.\d+$/.exec(stable.trim());
  if (!match) {
    throw new Error(`Invalid stable kubernetes release ${stable.trim()}`);
  }
  return Number(match[1]);
}

// the supported minors, newest first
export function supportedMinorList(minors: SupportedMinors): number[] {
  return Array.from(
    { length: minors.supportedMinors },
    (_, index) => minors.latestMinor - index,
  );
}

export function oldestMinor(minors: SupportedMinors): number {
  return minors.latestMinor - minors.supportedMinors + 1;
}

// nodes install kubelet, kubeadm and kubectl from this apt
// repository, so it lists exactly the versions they can install
export function kubernetesPackagesUrl(minor: number): string {
  return `https://pkgs.k8s.io/core:/stable:/v1.${minor}/deb/Packages`;
}

const kubernetesPackages = ['kubelet', 'kubeadm', 'kubectl'];

// the packages must exist for x86 machines
const kubernetesArchitecture = 'amd64';

// returns the newest kubernetes release of an apt Packages file for which
// kubelet, kubeadm and kubectl are all available
export function newestPackageVersion(packages: string): string | undefined {
  const versions = new Map<string, Set<string>>(
    kubernetesPackages.map(name => [name, new Set()]),
  );

  for (const stanza of packages.split(/\n\s*\n/)) {
    const fields = new Map<string, string>();
    for (const line of stanza.split('\n')) {
      const separator = line.indexOf(':');
      if (separator > 0 && !line.startsWith(' ')) {
        fields.set(line.slice(0, separator), line.slice(separator + 1).trim());
      }
    }

    const release = /^(\d+\.\d+\.\d+)-/.exec(fields.get('Version') ?? '');
    const packageVersions = versions.get(fields.get('Package') ?? '');
    if (
      release &&
      packageVersions &&
      fields.get('Architecture') === kubernetesArchitecture
    ) {
      packageVersions.add(release[1]);
    }
  }

  const complete = [...versions.get('kubeadm')!].filter(release =>
    kubernetesPackages.every(name => versions.get(name)!.has(release)),
  );

  return complete
    .map(release => ({ release, patch: Number(release.split('.')[2]) }))
    .sort((a, b) => b.patch - a.patch)
    .map(({ release }) => `v${release}`)[0];
}

// k0smotron downloads the k0s binaries from the github releases
export const k0sReleasesUrl =
  'https://api.github.com/repos/k0sproject/k0s/releases';

export type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
};

type K0sVersion = {
  tag: string;
  minor: number;
  patch: number;
  build: number;
};

export function parseK0sVersion(tag: string): K0sVersion | undefined {
  const match = /^v1\.(\d+)\.(\d+)\+k0s\.(\d+)$/.exec(tag);
  if (!match) {
    return undefined;
  }

  return {
    tag,
    minor: Number(match[1]),
    patch: Number(match[2]),
    build: Number(match[3]),
  };
}

// returns the newest stable k0s release of the newest minors k0s has
// released, newest minor first. k0s may lag behind kubernetes, so minors from
// one below the supported ones are considered as well. A k0s release carries
// a build number, so the newest build of the newest patch release wins
export function newestK0sVersions(
  releases: GithubRelease[],
  minors: SupportedMinors,
): MinorVersion[] {
  const newest = new Map<number, K0sVersion>();

  for (const release of releases) {
    if (release.draft || release.prerelease) {
      continue;
    }

    const version = parseK0sVersion(release.tag_name);
    if (
      !version ||
      version.minor < oldestK0sMinor(minors) ||
      version.minor > minors.latestMinor
    ) {
      continue;
    }

    const current = newest.get(version.minor);
    if (
      !current ||
      version.patch > current.patch ||
      (version.patch === current.patch && version.build > current.build)
    ) {
      newest.set(version.minor, version);
    }
  }

  return [...newest.values()]
    .sort((a, b) => b.minor - a.minor)
    .slice(0, minors.supportedMinors)
    .map(version => ({ minor: `1.${version.minor}`, version: version.tag }));
}

export function oldestK0sMinor(minors: SupportedMinors): number {
  return oldestMinor(minors) - 1;
}
