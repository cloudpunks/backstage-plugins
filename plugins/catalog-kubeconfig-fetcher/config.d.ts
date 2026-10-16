export interface Config {
  kubeconfig?: {
    /**
     * Name of the cluster in kubernetes.clusterLocatorMethods that holds the
     * kubeconfig ConfigMaps, the card reads them through the proxy of the
     * kubernetes plugin
     * @visibility frontend
     */
    managementCluster: string;
    /**
     * The ConfigMap of an entity lives in the namespace `<namespacePrefix><entity name>`
     * @default 'cluster-'
     * @visibility frontend
     */
    namespacePrefix?: string;
    /**
     * Name of the ConfigMap that holds the kubeconfig
     * @default 'oidc-kubeconfig'
     * @visibility frontend
     */
    configMapName?: string;
    /**
     * Key of the kubeconfig in the data of the ConfigMap
     * @default 'kubeconfig'
     * @visibility frontend
     */
    configMapKey?: string;
    /**
     * Text shown above the buttons, e.g. how to sign in to the cluster
     * @visibility frontend
     */
    instructions?: string;
  };
}
