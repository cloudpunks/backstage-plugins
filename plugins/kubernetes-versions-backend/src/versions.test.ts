import fs from 'fs';
import path from 'path';
import {
  GithubRelease,
  isDistribution,
  newestK0sVersions,
  newestPackageVersion,
  stableMinor,
  supportedMinorList,
} from './versions';

function release(tag: string, prerelease = false): GithubRelease {
  return { tag_name: tag, draft: false, prerelease };
}

function stanza(name: string, version: string, architecture = 'amd64') {
  return `Package: ${name}\nVersion: ${version}\nArchitecture: ${architecture}\nDescription: ${name}\n multi line description\n`;
}

const minors = { latestMinor: 36, supportedMinors: 3 };

describe('stableMinor', () => {
  it('reads the minor of the stable release', () => {
    expect(stableMinor('v1.37.1\n')).toBe(37);
  });

  it('rejects anything else', () => {
    expect(() => stableMinor('<html>')).toThrow(
      'Invalid stable kubernetes release <html>',
    );
  });
});

describe('supportedMinorList', () => {
  it('lists the supported minors, newest first', () => {
    expect(supportedMinorList(minors)).toEqual([36, 35, 34]);
  });
});

describe('newestPackageVersion', () => {
  it('reads the newest release of the apt repository', () => {
    // an excerpt of the packages of kubernetes v1.36 from pkgs.k8s.io, with
    // another package, another architecture and a package revision
    const packages = fs.readFileSync(
      path.join(__dirname, '__fixtures__', 'kubernetes-v1.36-Packages'),
      'utf8',
    );

    expect(newestPackageVersion(packages)).toBe('v1.36.5');
  });

  it('requires kubelet, kubeadm and kubectl for amd64', () => {
    const packages = [
      stanza('kubelet', '1.36.4-1.1'),
      stanza('kubeadm', '1.36.4-1.1'),
      stanza('kubectl', '1.36.4-1.1'),
      stanza('kubelet', '1.36.5-1.1'),
      stanza('kubeadm', '1.36.5-1.1'),
      stanza('kubectl', '1.36.5-1.1', 'arm64'),
    ].join('\n');

    expect(newestPackageVersion(packages)).toBe('v1.36.4');
  });

  it('compares patch releases numerically and ignores package revisions', () => {
    const packages = ['9-1.1', '10-2.1']
      .flatMap(patch =>
        ['kubelet', 'kubeadm', 'kubectl'].map(name =>
          stanza(name, `1.36.${patch}`),
        ),
      )
      .join('\n');

    expect(newestPackageVersion(packages)).toBe('v1.36.10');
  });

  it('returns nothing for an empty repository', () => {
    expect(newestPackageVersion('')).toBeUndefined();
  });
});

describe('newestK0sVersions', () => {
  it('returns the newest k0s release of the supported minors, newest first', () => {
    const releases = [
      release('v1.37.0+k0s.0'),
      release('v1.36.4+k0s.10'),
      release('v1.36.5+k0s.0'),
      release('v1.36.5+k0s.2'),
      release('v1.35.8+k0s.1'),
      release('v1.32.9+k0s.0'),
    ];

    expect(newestK0sVersions(releases, minors)).toEqual([
      { minor: '1.36', version: 'v1.36.5+k0s.2' },
      { minor: '1.35', version: 'v1.35.8+k0s.1' },
    ]);
  });

  it('falls back to the minor below while k0s lags behind kubernetes', () => {
    const releases = [
      release('v1.36.4+k0s.1'),
      release('v1.35.8+k0s.1'),
      release('v1.34.11+k0s.1'),
      release('v1.33.15+k0s.0'),
    ];

    expect(
      newestK0sVersions(releases, { latestMinor: 37, supportedMinors: 3 }),
    ).toEqual([
      { minor: '1.36', version: 'v1.36.4+k0s.1' },
      { minor: '1.35', version: 'v1.35.8+k0s.1' },
      { minor: '1.34', version: 'v1.34.11+k0s.1' },
    ]);
  });

  it('offers only the supported number of minors', () => {
    const releases = [
      release('v1.36.4+k0s.1'),
      release('v1.35.8+k0s.1'),
      release('v1.34.11+k0s.1'),
      release('v1.33.15+k0s.0'),
    ];

    expect(newestK0sVersions(releases, minors)).toHaveLength(3);
  });

  it('skips pre-releases, drafts and other tags', () => {
    const releases = [
      release('v1.36.6-rc.0+k0s.0', true),
      release('v1.36.6+k0s.0', true),
      { tag_name: 'v1.36.7+k0s.0', draft: true, prerelease: false },
      release('v1.36.8'),
      release('v1.36.5+k0s.0'),
    ];

    expect(newestK0sVersions(releases, minors)).toEqual([
      { minor: '1.36', version: 'v1.36.5+k0s.0' },
    ]);
  });
});

describe('isDistribution', () => {
  it('only accepts the known distributions', () => {
    expect(isDistribution('kubernetes')).toBe(true);
    expect(isDistribution('k0s')).toBe(true);
    expect(isDistribution('toString')).toBe(false);
  });
});
