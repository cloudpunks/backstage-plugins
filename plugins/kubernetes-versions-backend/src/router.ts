import { NotFoundError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { KubernetesVersionsService } from './KubernetesVersionsService';
import { isDistribution } from './versions';

export async function createRouter({
  versions,
}: {
  versions: Pick<KubernetesVersionsService, 'list'>;
}): Promise<express.Router> {
  const router = Router();

  // returns the newest release of every supported minor, the cluster
  // templates show the minor and use the version of the selected entry
  router.get('/:distribution', async (req, res) => {
    const { distribution } = req.params;
    if (!isDistribution(distribution)) {
      throw new NotFoundError(`Unknown distribution ${distribution}`);
    }

    res.json(await versions.list(distribution));
  });

  return router;
}
