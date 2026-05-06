// In dev: VITE_API_URL is undefined → '' → vite proxy handles /api → localhost:3001
// In prod: VITE_API_URL = 'https://buyer-dashboard-backend.onrender.com'
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
