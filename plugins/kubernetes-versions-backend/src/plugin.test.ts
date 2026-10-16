import {
  mockCredentials,
  mockServices,
  startTestBackend,
} from '@backstage/backend-test-utils';
import request from 'supertest';
import { kubernetesVersionsPlugin } from './plugin';

describe('kubernetesVersionsPlugin', () => {
  beforeEach(() => {
    // stable release 1.36.5, and only the apt repository of 1.36 exists
    jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url === 'https://dl.k8s.io/release/stable.txt') {
        return new Response('v1.36.5\n');
      }
      if (url === 'https://pkgs.k8s.io/core:/stable:/v1.36/deb/Packages') {
        return new Response(
          ['kubelet', 'kubeadm', 'kubectl']
            .map(
              name =>
                `Package: ${name}\nVersion: 1.36.5-1.1\nArchitecture: amd64\n`,
            )
            .join('\n'),
        );
      }
      return new Response('', { status: 403 });
    });
  });

  afterEach(() => jest.restoreAllMocks());

  async function startBackend() {
    const { server } = await startTestBackend({
      features: [
        kubernetesVersionsPlugin,
        mockServices.rootConfig.factory({
          data: { kubernetesVersions: { supportedMinors: 3 } },
        }),
      ],
    });
    return server;
  }

  it('lists the supported versions of a distribution', async () => {
    const server = await startBackend();

    const response = await request(server).get(
      '/api/kubernetes-versions/kubernetes',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ minor: '1.36', version: 'v1.36.5' }]);
  });

  it('rejects unknown distributions', async () => {
    const server = await startBackend();

    const response = await request(server).get('/api/kubernetes-versions/rke2');

    expect(response.status).toBe(404);
  });

  it('rejects unauthenticated requests', async () => {
    const server = await startBackend();

    const response = await request(server)
      .get('/api/kubernetes-versions/kubernetes')
      .set('Authorization', mockCredentials.none.header());

    expect(response.status).toBe(401);
  });
});
