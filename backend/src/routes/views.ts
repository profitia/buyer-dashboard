import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const viewsRouter = Router();

// GET /api/views
viewsRouter.get('/views', async (_req, res) => {
  try {
    const views = await prisma.savedView.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(views);
  } catch {
    res.status(500).json({ error: 'Failed to fetch views' });
  }
});

// POST /api/views
viewsRouter.post('/views', async (req, res) => {
  const { name, filters } = req.body as { name: string; filters: unknown };
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const view = await prisma.savedView.create({
      data: { name: name.trim(), filters: filters as object },
    });
    res.status(201).json(view);
  } catch {
    res.status(500).json({ error: 'Failed to create view' });
  }
});

// DELETE /api/views/:id
viewsRouter.delete('/views/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.savedView.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'View not found' });
  }
});
