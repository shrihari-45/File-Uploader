const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
    healthCheck,
    uploadFile,
    getFiles,
    getFileById,
    downloadFileById,
    deleteFileById
} = require('../controllers/fileController');

router.get('/health', healthCheck);
router.post('/files/upload', protect, upload.single('file'), uploadFile);
router.get('/files', protect, getFiles);
router.get('/files/:id', protect, getFileById);
router.get('/files/:id/download', protect, downloadFileById);
router.delete('/files/:id', protect, deleteFileById);

module.exports = router;