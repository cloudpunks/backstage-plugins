# Backstage Plugins

[![General Workflow](https://github.com/cloudpunks/backstage-plugins/actions/workflows/general.yml/badge.svg)](https://github.com/cloudpunks/backstage-plugins/actions/workflows/general.yml) [![GitHub Repo](https://img.shields.io/badge/github-repo-yellowgreen)](https://github.com/cloudpunks/backstage-plugins)

This repository contains our plugins for [Backstage][backstage], published as
separate packages to [NPM][npm]. All frontend modules are built for the new
frontend system.

| Plugin                                                                     | Role                         | Description                                                 |
| -------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| [`kubernetes-versions-backend`](plugins/kubernetes-versions-backend)       | backend plugin               | Lists the supported Kubernetes and k0s releases             |
| [`scaffolder-kubernetes-versions`](plugins/scaffolder-kubernetes-versions) | frontend module (scaffolder) | `KubernetesVersionPicker` field for the versions backend    |
| [`catalog-kubeconfig-fetcher`](plugins/catalog-kubeconfig-fetcher)         | frontend module (catalog)    | Entity card to download or copy the kubeconfig of a cluster |

## Prerequisites

We use [mise][mise] to manage all required tools and their versions. Install it
by following the [official installation instructions][mise-install], then run
the following commands inside the repository to activate mise and install all
tools defined in `mise.toml`:

```console
mise trust
mise install
```

## Usage

`packages/app` and `packages/backend` are only a development setup to try the
plugins, `entities/` holds the sample catalog data it loads. See
`app-config.yaml` for the configuration.

```console
yarn install
yarn start
```

This starts the dev app on port 3000 and the backend on port 7007.

## Testing

Every code change needs a Jest test next to the source (`*.test.ts(x)`). The
same checks are executed by the general workflow on every pull request:

```console
yarn tsc:full
yarn lint:all
yarn prettier:check
yarn test:all
yarn build:all
```

## Security

If you find a security issue please contact
[info@cloudpunks.de](mailto:info@cloudpunks.de) first.

## Contributing

Generally we are following [conventional commits][commits] when we apply
changes. That way we are able to generate proper changelogs for every release.
Please use always pull requests to integrate new functionalities or to fix
issues.

For the release process we are following [semantic versioning][semver] which
clearly indicates if a new version just resolves bugs, includes new features or
even includes breaking changes. All packages are released together with the
same version.

If you have changed something on the source you should simply commit following
the mentioned conventions:

```console
git checkout -b feat/new-feature
git add --all
git commit -m 'feat: added awesome new feature'
git push --set-upstream origin feat/new-feature
```

After pushing your changes into the Git repository you should create a pull
request on GitHub. If the pull request have been merged and everything built
fine it will also create automatically a new release at least once a week, or
whenever the release workflow is started manually. The changelog, the GitHub
release and the publishing to npm are fully automated, the packages are
published with provenance using the OIDC token of the workflow
([trusted publishing][trusted]) instead of an npm token.

## Authors

- [Thomas Boerger](https://github.com/tboerger)

## License

Apache-2.0

## Copyright

```console
Copyright (c) 2026 cloudpunks GmbH <info@cloudpunks.de>
```

[backstage]: https://backstage.io/
[npm]: https://www.npmjs.com/org/cloudpunks
[mise]: https://mise.jdx.dev/
[mise-install]: https://mise.jdx.dev/getting-started.html
[commits]: https://www.conventionalcommits.org/en/v1.0.0/
[semver]: https://semver.org/
[trusted]: https://docs.npmjs.com/trusted-publishers
