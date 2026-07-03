const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/upload', authMiddleware, upload.single('resume'), resumeController.uploadResume);
router.get('/history', authMiddleware, resumeController.getMyHistory);
router.get('/:id/result', authMiddleware, resumeController.getResumeResult);

module.exports = router;
