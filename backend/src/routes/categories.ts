import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import type { SaveCategoryRequest } from '../../../shared/types';

export const categoriesRouter = Router();

// GET /api/categories — list all saved categories
categoriesRouter.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.savedCategory.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ categories: rows });
  } catch (err) {
    console.error('[Categories GET]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/categories — create or update a category
categoriesRouter.post('/categories', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as SaveCategoryRequest;
  if (!body?.name?.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const data = {
      name: body.name.trim(),
      steelWeight:     body.weights.steel,
      aluminumWeight:  body.weights.aluminum,
      transportWeight: body.weights.transport,
      energyWeight:    body.weights.energy,
      basePrice:       body.basePrice,
      supplierPrices:  JSON.stringify(body.supplierPrices ?? []),
      timeRange:       body.timeRange ?? '3Y',
      template:        body.template ?? 'custom',
    };

    let category;
    if (body.id) {
      category = await prisma.savedCategory.update({ where: { id: body.id }, data });
    } else {
      category = await prisma.savedCategory.create({ data });
    }
    res.json({ category });
  } catch (err) {
    console.error('[Categories POST]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/categories/:id
categoriesRouter.delete('/categories/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.savedCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Categories DELETE]', err);
    res.status(500).json({ error: 'Database error' });
  }
});
