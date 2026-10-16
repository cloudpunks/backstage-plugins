import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/frontend-test-utils';
import { KubeconfigCard, kubeconfigPath } from './KubeconfigCard';

function clusterEntity(name: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name,
    },
    spec: { type: 'kubernetes-cluster', owner: 'user:default/guest' },
  };
}

const kubeconfig = 'apiVersion: v1\nkind: Config\n';

// switches to the next entity like navigating between two cluster pages
function EntitySwitcher({ entities }: { entities: Entity[] }) {
  const [index, setIndex] = useState(0);

  return (
    <>
      <button onClick={() => setIndex(index + 1)}>Next entity</button>
      <EntityProvider entity={entities[index]}>
        <KubeconfigCard />
      </EntityProvider>
    </>
  );
}

function renderCard(
  response: Response | jest.Mock,
  entities: Entity[] = [clusterEntity('test')],
  kubeconfigConfig: Record<string, string> = {},
) {
  const fetch =
    response instanceof Response
      ? jest.fn().mockResolvedValue(response)
      : response;

  renderInTestApp(
    <TestApiProvider
      apis={[
        [
          configApiRef,
          mockApis.config({
            data: {
              kubeconfig: { managementCluster: 'mgmt', ...kubeconfigConfig },
            },
          }),
        ],
        [discoveryApiRef, mockApis.discovery({ baseUrl: 'http://backstage' })],
        [fetchApiRef, { fetch }],
      ]}
    >
      <EntitySwitcher entities={entities} />
    </TestApiProvider>,
  );

  return fetch;
}

function readyResponse() {
  return new Response(JSON.stringify({ data: { kubeconfig } }));
}

// jsdom lacks some of the browser apis the card uses, so the tests define
// them and have to restore the original state afterwards
const patchedProperties: Array<[object, string]> = [
  [navigator, 'clipboard'],
  [URL, 'createObjectURL'],
  [URL, 'revokeObjectURL'],
];

const originalProperties = patchedProperties.map(([target, key]) => ({
  target,
  key,
  descriptor: Object.getOwnPropertyDescriptor(target, key),
}));

function restoreProperties() {
  for (const { target, key, descriptor } of originalProperties) {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Reflect.deleteProperty(target, key);
    }
  }
}

function mockClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('KubeconfigCard', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    restoreProperties();
  });

  it('requests the configmap of the management cluster through the kubernetes proxy', async () => {
    const fetch = renderCard(readyResponse());

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        'http://backstage/api/kubernetes/proxy/api/v1/namespaces/cluster-test/configmaps/oidc-kubeconfig',
        { headers: { 'Backstage-Kubernetes-Cluster': 'mgmt' } },
      ),
    );
  });

  it('downloads the kubeconfig and revokes the object url afterwards', async () => {
    jest.useFakeTimers();
    const createObjectURL = jest.fn().mockReturnValue('blob:kubeconfig');
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    renderCard(readyResponse());

    // user-event would flush the pending revoke timeout with the fake timers
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));

    expect(click).toHaveBeenCalled();
    expect(click.mock.contexts[0]).toMatchObject({
      download: 'kubeconfig-test.yaml',
      href: 'blob:kubeconfig',
    });
    expect(revokeObjectURL).not.toHaveBeenCalled();

    act(() => jest.runOnlyPendingTimers());

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:kubeconfig');
  });

  it('copies the kubeconfig and resets the button afterwards', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockClipboard(writeText);

    renderCard(readyResponse());

    await user.click(await screen.findByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(kubeconfig);
    expect(
      await screen.findByRole('button', { name: 'Copied' }),
    ).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(2000));

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows when copying is not possible', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    const user = userEvent.setup();
    mockClipboard(writeText);

    renderCard(readyResponse());

    await user.click(await screen.findByRole('button', { name: 'Copy' }));

    expect(
      await screen.findByRole('button', { name: 'Copy failed' }),
    ).toBeInTheDocument();
  });

  it('explains that the kubeconfig is not generated yet', async () => {
    renderCard(
      new Response(
        JSON.stringify({
          kind: 'Status',
          status: 'Failure',
          reason: 'NotFound',
        }),
        { status: 404 },
      ),
    );

    expect(await screen.findByText('Not available yet')).toBeInTheDocument();
  });

  it('shows backstage errors like an unknown cluster instead of a missing kubeconfig', async () => {
    renderCard(
      new Response(
        JSON.stringify({
          error: { name: 'NotFoundError', message: "Cluster 'mgmt' not found" },
        }),
        { status: 404 },
      ),
    );

    expect(
      await screen.findByText('Unable to load the kubeconfig'),
    ).toBeInTheDocument();
    expect(screen.getByText("Cluster 'mgmt' not found")).toBeInTheDocument();
  });

  it('does not offer the kubeconfig of the previous entity while loading', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(readyResponse())
      .mockReturnValueOnce(new Promise(() => {}));

    renderCard(fetch, [clusterEntity('first'), clusterEntity('second')]);

    expect(
      await screen.findByRole('button', { name: 'Download' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole('button', { name: 'Download' }),
    ).not.toBeInTheDocument();
  });

  it('shows errors from the proxy', async () => {
    renderCard(
      new Response('forbidden', { status: 403, statusText: 'Forbidden' }),
    );

    expect(
      await screen.findByText('Unable to load the kubeconfig'),
    ).toBeInTheDocument();
    expect(screen.getByText('403 Forbidden')).toBeInTheDocument();
  });

  it('reads the configmap and key from the config', async () => {
    const fetch = renderCard(
      new Response(JSON.stringify({ data: { custom: kubeconfig } })),
      [clusterEntity('test')],
      {
        namespacePrefix: 'ns-',
        configMapName: 'my-kubeconfig',
        configMapKey: 'custom',
      },
    );

    expect(
      await screen.findByRole('button', { name: 'Download' }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      'http://backstage/api/kubernetes/proxy/api/v1/namespaces/ns-test/configmaps/my-kubeconfig',
      { headers: { 'Backstage-Kubernetes-Cluster': 'mgmt' } },
    );
  });

  it('shows the configured instructions', async () => {
    renderCard(readyResponse(), [clusterEntity('test')], {
      instructions: 'Install kubelogin first',
    });

    expect(await screen.findByText('Install kubelogin first')).toBeVisible();
  });

  it('escapes the cluster name in the path', () => {
    expect(kubeconfigPath('a/b')).toBe(
      '/proxy/api/v1/namespaces/cluster-a%2Fb/configmaps/oidc-kubeconfig',
    );
  });

  it('uses a custom namespace prefix and configmap name in the path', () => {
    expect(
      kubeconfigPath('a', { namespacePrefix: 'ns-', configMapName: 'cfg' }),
    ).toBe('/proxy/api/v1/namespaces/ns-a/configmaps/cfg');
  });
});
