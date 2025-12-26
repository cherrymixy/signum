import { Router } from 'express';
import { analyzeImage } from '../controllers/analysisController';

const router = Router();

router.post('/', analyzeImage);

export default router;



