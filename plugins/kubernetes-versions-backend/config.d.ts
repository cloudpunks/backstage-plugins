export interface Config {
  /**
   * Kubernetes versions offered by the cluster templates
   */
  kubernetesVersions?: {
    /**
     * Number of offered minors, counted down from the minor of the newest
     * stable kubernetes release
     * @default 3
     */
    supportedMinors?: number;
  };
}
