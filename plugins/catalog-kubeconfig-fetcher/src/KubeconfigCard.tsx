import { useCallback, useEffect, useState } from 'react';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Skeleton,
  Text,
} from '@backstage/ui';

export type KubeconfigLocation = {
  namespacePrefix: string;
  configMapName: string;
};

export const defaultLocation: KubeconfigLocation = {
  namespacePrefix: 'cluster-',
  configMapName: 'oidc-kubeconfig',
};

// the ConfigMap lives in the management cluster and must only contain public
// data (endpoint, CA certificate and e.g. an OIDC login), because every
// signed-in user reads it through the proxy of the kubernetes plugin
export function kubeconfigPath(
  clusterName: string,
  { namespacePrefix, configMapName }: KubeconfigLocation = defaultLocation,
): string {
  return `/proxy/api/v1/namespaces/${encodeURIComponent(
    `${namespacePrefix}${clusterName}`,
  )}/configmaps/${encodeURIComponent(configMapName)}`;
}

// how long the copy button shows its result before it resets
const COPY_FEEDBACK_MS = 2000;

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kubeconfig: string };

type CopyState = 'idle' | 'copied' | 'failed';

const copyLabels: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed',
};

// the kubernetes api answers a missing ConfigMap with a Status object, while
// backstage errors like an unknown cluster name come as serialized errors
async function notFoundState(response: Response): Promise<State> {
  const body = await response.json().catch(() => undefined);
  if (body?.error?.name) {
    return {
      status: 'error',
      message: body.error.message ?? body.error.name,
    };
  }
  return { status: 'missing' };
}

export function KubeconfigCard() {
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copyState, setCopyState] = useState<CopyState>('idle');

  // without this header the proxy picks the first configured cluster
  const clusterName = configApi.getString('kubeconfig.managementCluster');
  const namespacePrefix =
    configApi.getOptionalString('kubeconfig.namespacePrefix') ??
    defaultLocation.namespacePrefix;
  const configMapName =
    configApi.getOptionalString('kubeconfig.configMapName') ??
    defaultLocation.configMapName;
  const configMapKey =
    configApi.getOptionalString('kubeconfig.configMapKey') ?? 'kubeconfig';
  const instructions = configApi.getOptionalString('kubeconfig.instructions');

  const name = entity.metadata.name;
  const fileName = `kubeconfig-${name}.yaml`;

  useEffect(() => {
    let cancelled = false;
    // don't offer the kubeconfig of the previous entity while loading
    setState({ status: 'loading' });
    setCopyState('idle');

    (async (): Promise<State> => {
      const baseUrl = await discoveryApi.getBaseUrl('kubernetes');
      const response = await fetchApi.fetch(
        `${baseUrl}${kubeconfigPath(name, { namespacePrefix, configMapName })}`,
        { headers: { 'Backstage-Kubernetes-Cluster': clusterName } },
      );

      if (response.status === 404) {
        return notFoundState(response);
      }
      if (!response.ok) {
        return {
          status: 'error',
          message: `${response.status} ${response.statusText}`,
        };
      }

      const configMap = await response.json();
      const kubeconfig = configMap?.data?.[configMapKey];

      return kubeconfig
        ? { status: 'ready', kubeconfig }
        : { status: 'missing' };
    })()
      .catch((e): State => ({ status: 'error', message: String(e) }))
      .then(result => {
        if (!cancelled) {
          setState(result);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    discoveryApi,
    fetchApi,
    name,
    clusterName,
    namespacePrefix,
    configMapName,
    configMapKey,
  ]);

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }
    const timeout = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [copyState]);

  const download = useCallback(() => {
    if (state.status !== 'ready') {
      return;
    }
    const url = URL.createObjectURL(
      new Blob([state.kubeconfig], { type: 'application/yaml' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // revoking right after the click aborts the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url));
  }, [state, fileName]);

  const copy = useCallback(async () => {
    if (state.status !== 'ready') {
      return;
    }
    try {
      // fails outside of secure contexts or without clipboard permission
      await navigator.clipboard.writeText(state.kubeconfig);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <Text as="h3" variant="title-x-small" weight="bold">
          Kubeconfig
        </Text>
      </CardHeader>
      <CardBody>
        {state.status === 'loading' && <Skeleton height={36} />}

        {state.status === 'missing' && (
          <Alert
            status="info"
            title="Not available yet"
            description="The kubeconfig has not been generated yet, this can take a few minutes after the cluster was created."
          />
        )}

        {state.status === 'error' && (
          <Alert
            status="danger"
            title="Unable to load the kubeconfig"
            description={state.message}
          />
        )}

        {state.status === 'ready' && (
          <Flex direction="column" gap="3">
            {instructions && <Text as="p">{instructions}</Text>}
            <Flex gap="2">
              <Button variant="primary" onPress={download}>
                Download
              </Button>
              <Button variant="secondary" onPress={copy}>
                {copyLabels[copyState]}
              </Button>
            </Flex>
          </Flex>
        )}
      </CardBody>
    </Card>
  );
}
