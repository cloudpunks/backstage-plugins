# @cloudpunks/backstage-plugin-kubernetes-versions-backend

Backend plugin that lists the Kubernetes and [k0s](https://k0sproject.io)
releases you want to offer, e.g. in a scaffolder template. It serves the newest
release per minor for the minor of the newest stable Kubernetes release and the
`supportedMinors - 1` minors below it, newest first:

```json
[{ "minor": "1.36", "version": "v1.36.5" }]
```

Use it with the field of
[`@cloudpunks/backstage-plugin-scaffolder-kubernetes-versions`](../scaffolder-kubernetes-versions).

## Installation

```console
yarn --cwd packages/backend add @cloudpunks/backstage-plugin-kubernetes-versions-backend
```

```ts
// packages/backend/src/index.ts
backend.add(import('@cloudpunks/backstage-plugin-kubernetes-versions-backend'));
```

## Configuration

```yaml
kubernetesVersions:
  # number of offered minors, counted down from the newest stable minor
  supportedMinors: 3
```

## API

| Endpoint                              | Source                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/kubernetes-versions/kubernetes` | `pkgs.k8s.io` apt repository of each minor, only versions with `kubelet`, `kubeadm` and `kubectl` for amd64. Minors without a repository yet are left out. |
| `/api/kubernetes-versions/k0s`        | GitHub releases of `k0sproject/k0s`, newest `+k0s.N` build per minor. It may lag one minor behind Kubernetes.                                              |

The newest stable Kubernetes release comes from
`https://dl.k8s.io/release/stable.txt`.

Requests time out after 10 seconds and results are cached for eight hours, so a
new release can take that long to show up. After a failed load the source is
left alone for five minutes and the last loaded value is served, without one the
request fails. GitHub is queried without a token (60 requests per hour and ip
address).
