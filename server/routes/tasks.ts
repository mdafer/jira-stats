import { Router } from 'express';
import { getTasks, refreshTasks, clearCacheHandler, getCacheStatus } from '../controllers/tasksController.js';

const router = Router();

router.get('/tasks', getTasks);
router.post('/tasks/refresh', refreshTasks);
router.delete('/cache', clearCacheHandler);
router.get('/cache/status', getCacheStatus);

export default router;
