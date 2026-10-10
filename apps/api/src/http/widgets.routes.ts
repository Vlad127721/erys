import { createWidgetSchema, updateTextSchema } from '@youscan/shared';
import { Router } from 'express';
import type { WidgetsService } from '../widgets/widgets.service.js';
import { parseWith, uuidParam } from './validate.js';

export function widgetsRouter(widgets: WidgetsService): Router {
  const router = Router();

  /** Metadata only; each widget fetches its own data so it can load and fail on its own. */
  router.get('/widgets', async (_req, res) => {
    res.json(await widgets.list());
  });

  router.get('/widgets/:id/data', async (req, res) => {
    res.json(await widgets.getData(uuidParam(req.params.id)));
  });

  router.post('/widgets', async (req, res) => {
    const body = parseWith(createWidgetSchema, req.body ?? {});
    res.status(201).json(await widgets.create(body));
  });

  router.put('/widgets/:id/text', async (req, res) => {
    const id = uuidParam(req.params.id);
    const { text } = parseWith(updateTextSchema, req.body ?? {});
    res.json(await widgets.updateText(id, text));
  });

  router.delete('/widgets/:id', async (req, res) => {
    await widgets.remove(uuidParam(req.params.id));
    res.status(204).end();
  });

  return router;
}
