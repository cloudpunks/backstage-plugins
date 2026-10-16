import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

// the filter can be replaced in app-config.yaml, e.g. to only show the card
// for clusters that carry a certain label:
//
// app:
//   extensions:
//     - entity-card:catalog/kubeconfig:
//         config:
//           filter:
//             kind: resource
//             metadata.labels.example.com/cluster-class: { $exists: true }
const kubeconfigCard = EntityCardBlueprint.make({
  name: 'kubeconfig',
  params: {
    type: 'info',
    filter: {
      kind: 'resource',
      'spec.type': 'kubernetes-cluster',
    },
    loader: async () =>
      import('./KubeconfigCard').then(m => <m.KubeconfigCard />),
  },
});

/**
 * Adds a card to download or copy the kubeconfig of a cluster entity
 *
 * @public
 */
export const catalogKubeconfigFetcherModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [kubeconfigCard],
});
