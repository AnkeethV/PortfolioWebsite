import loginHandler from '../_lib/admin/login.js';
import logoutHandler from '../_lib/admin/logout.js';
import meHandler from '../_lib/admin/me.js';
import personalInfoHandler from '../_lib/admin/personal-info.js';
import experienceHandler from '../_lib/admin/experience.js';
import projectsHandler from '../_lib/admin/projects.js';
import skillsHandler from '../_lib/admin/skills.js';
import faqHandler from '../_lib/admin/faq.js';
import resetPasswordHandler from '../_lib/admin/reset-password.js';
import uploadHandler from '../_lib/admin/upload.js';
import backupHandler from '../_lib/admin/backup.js';
import { ensureSeeded } from '../_lib/seed.js';

const handlers = {
  'login': loginHandler,
  'logout': logoutHandler,
  'me': meHandler,
  'personal-info': personalInfoHandler,
  'experience': experienceHandler,
  'projects': projectsHandler,
  'skills': skillsHandler,
  'faq': faqHandler,
  'reset-password': resetPasswordHandler,
  'upload': uploadHandler,
  'backup': backupHandler
};

/**
 * Consolidated Admin API Router (Vercel Serverless Function)
 * Routes /api/admin/:route to the corresponding admin sub-handler.
 * Automatically ensures DB is seeded on first load.
 */
export default async function handler(req, res) {
  // Ensure DB has initial data if DB is connected
  try {
    await ensureSeeded();
  } catch (_) {}

  // Safely parse JSON body if string
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }

  const route = req.query?.route || (req.url ? req.url.split('?')[0].replace(/^\/api\/admin\/?/, '') : '');
  const targetHandler = handlers[route];
  if (targetHandler) {
    return targetHandler(req, res);
  }
  return res.status(404).json({ error: `Admin endpoint not found: /api/admin/${route}` });
}
