import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { KubernetesVersionsService } from './KubernetesVersionsService';
import { createRouter } from './router';

/**
 * Lists the Kubernetes and k0s releases consumers like scaffolder templates offer
 *
 * @public
 */
export const kubernetesVersionsPlugin = createBackendPlugin({
  pluginId: 'kubernetes-versions',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, logger, httpRouter }) {
        const versions = new KubernetesVersionsService({
          logger,
          supportedMinors:
            config.getOptionalNumber('kubernetesVersions.supportedMinors') ?? 3,
        });

        httpRouter.use(await createRouter({ versions }));
      },
    });
  },
});
