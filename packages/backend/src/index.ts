import { createBackend } from '@backstage/backend-defaults';

// development backend to try the plugins of this repository
const backend = createBackend();

backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-kubernetes-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@cloudpunks/backstage-plugin-kubernetes-versions-backend'));

backend.start();
