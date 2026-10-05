import app from '../../api/romtech.js';
import { webHandler } from '../../server/web-handler.mjs';
export default webHandler(app);
export const config = { path: '/api/romtech' };
