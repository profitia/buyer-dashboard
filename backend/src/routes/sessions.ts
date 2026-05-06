import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const sessionsRouter = Router();

// GET /api/sessions — list all sessions (meta only, no messages)
sessionsRouter.get('/sessions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });

    res.json({
      sessions: sessions.map((s) => ({
        id:           s.id,
        title:        s.title,
        createdAt:    s.createdAt.toISOString(),
        updatedAt:    s.updatedAt.toISOString(),
        messageCount: s._count.messages,
      })),
    });
  } catch (err) {
    console.error('[Sessions GET]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sessions/:id/messages — full message history for a session
sessionsRouter.get('/sessions/:id/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      messages: messages.map((m) => ({
        id:        m.id,
        role:      m.role,
        content:   m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[Session messages GET]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/sessions/:id
sessionsRouter.delete('/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.chatSession.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Session DELETE]', err);
    res.status(500).json({ error: 'Database error' });
  }
});
