const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

router.use(authMiddleware, adminOnly);

router.get('/users', adminController.listUsers);
router.get('/resumes', adminController.listAllResumes);
router.get('/reports', adminController.getReports);

module.exports = router;
