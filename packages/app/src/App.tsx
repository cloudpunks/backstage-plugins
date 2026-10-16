import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import kubeconfigModule from '@cloudpunks/backstage-plugin-catalog-kubeconfig-fetcher';
import kubernetesVersionsModule from '@cloudpunks/backstage-plugin-scaffolder-kubernetes-versions';

// development app to try the plugins of this repository
export default createApp({
  features: [
    catalogPlugin,
    kubernetesPlugin,
    scaffolderPlugin,
    kubeconfigModule,
    kubernetesVersionsModule,
  ],
});
