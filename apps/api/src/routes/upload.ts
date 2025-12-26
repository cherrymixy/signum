import { Router } from 'express';
import { upload } from '../middleware/upload';
import { uploadImage } from '../controllers/uploadController';

const router = Router();

router.post('/', upload.single('file'), uploadImage);

export default router;



