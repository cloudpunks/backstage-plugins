# @cloudpunks/backstage-plugin-scaffolder-kubernetes-versions

Frontend module for the new frontend system that adds the
`KubernetesVersionPicker` field to the scaffolder. It shows a dropdown of the
minors served by
[`@cloudpunks/backstage-plugin-kubernetes-versions-backend`](../kubernetes-versions-backend),
the value of the field is the newest patch release of the selected minor.

## Installation

Install the backend plugin first, then add the module to the app:

```console
yarn --cwd packages/app add @cloudpunks/backstage-plugin-scaffolder-kubernetes-versions
```

With `app.packages: all` the module is detected automatically, otherwise
register it:

```tsx
import kubernetesVersionsModule from '@cloudpunks/backstage-plugin-scaffolder-kubernetes-versions';

export default createApp({ features: [kubernetesVersionsModule] });
```

## Usage

```yaml
parameters:
  - properties:
      kubernetesVersion:
        title: Kubernetes Version
        type: string
        ui:field: KubernetesVersionPicker
        ui:options:
          # kubernetes (default) or k0s
          distribution: kubernetes
```
