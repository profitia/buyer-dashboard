import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { chatRouter } from './routes/chat';
import { categoriesRouter } from './routes/categories';
import { sessionsRouter } from './routes/sessions';
import { macroEventsRouter } from './routes/macroEvents';
import { viewsRouter } from './routes/views';
import { fredEventsRouter, runFredEventDetection } from './routes/fredEvents';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', chatRouter);
app.use('/api', categoriesRouter);
app.use('/api', sessionsRouter);
app.use('/api', macroEventsRouter);
app.use('/api', viewsRouter);
app.use('/api', fredEventsRouter);

// ─── Cron: run FRED event detection every 12h ─────────────────────────────────
const FRED_KEY = process.env.FRED_API_KEY;
if (FRED_KEY) {
  // Run once at startup (after 5s delay to let DB settle)
  setTimeout(() => {
    runFredEventDetection(FRED_KEY).then((r) =>
      console.log(`[cron] Initial FRED run: ${r.processed} detected, ${r.saved} saved`)
    ).catch((e) => console.warn('[cron] Initial FRED run failed:', e));
  }, 5000);

  // Then every 12 hours
  cron.schedule('0 */12 * * *', () => {
    runFredEventDetection(FRED_KEY).then((r) =>
      console.log(`[cron] FRED refresh: ${r.processed} detected, ${r.saved} saved`)
    ).catch((e) => console.warn('[cron] FRED refresh failed:', e));
  });
} else {
  console.warn('[cron] FRED_API_KEY not set — automatic event detection disabled');
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Buyer Dashboard Backend running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});

export default app;
