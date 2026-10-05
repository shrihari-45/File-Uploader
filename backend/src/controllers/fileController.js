const { Readable } = require('stream');
const { getGridFSBucket } = require('../config/db');
const GridFSService = require('../services/gridfsService');

const healthCheck = (req, res) => {
    res.status(200).json({
        success: true,
        message: 'File Uploader API is active & healthy',
        timestamp: new Date().toISOString()
    });
};

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided for upload.' });
        }

        const bucket = getGridFSBucket();
        const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const readableStream = Readable.from(req.file.buffer);

        const userId = req.user ? req.user._id.toString() : null;
        const userEmail = req.user ? req.user.email : null;

        const uploadStream = bucket.openUploadStream(originalname, {
            contentType: req.file.mimetype,
            metadata: {
                contentType: req.file.mimetype,
                mimeType: req.file.mimetype,
                size: req.file.size,
                uploadedAt: new Date(),
                userId,
                userEmail
            }
        });

        readableStream.on('error', (err) => {
            next(err);
        });

        uploadStream.on('error', (err) => {
            next(err);
        });

        readableStream.pipe(uploadStream);

        uploadStream.on('finish', () => {
            res.status(201).json({
                success: true,
                message: 'File uploaded successfully',
                file: {
                    id: uploadStream.id.toString(),
                    filename: originalname,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    uploadedAt: new Date().toISOString()
                }
            });
        });
    } catch (error) {
        next(error);
    }
};

const getFiles = async (req, res, next) => {
    try {
        const userId = req.user ? req.user._id.toString() : null;
        const files = await GridFSService.findAllFiles(userId);

        const formattedFiles = files.map(file => {
            const mimeType = (file.metadata && (file.metadata.contentType || file.metadata.mimeType)) || file.contentType || 'application/octet-stream';
            return {
                id: file._id.toString(),
                filename: file.filename,
                mimeType,
                size: file.length,
                uploadedAt: file.uploadDate
            };
        });

        res.status(200).json({
            success: true,
            count: formattedFiles.length,
            files: formattedFiles
        });
    } catch (error) {
        next(error);
    }
};

const getFileById = async (req, res, next) => {
    try {
        const fileId = req.params.id;
        const userId = req.user ? req.user._id.toString() : null;
        const fileRecord = await GridFSService.findFileById(fileId, userId);

        if (!fileRecord) {
            return res.status(404).json({ success: false, message: 'File not found or access denied.' });
        }

        const mimeType = (fileRecord.metadata && (fileRecord.metadata.contentType || fileRecord.metadata.mimeType)) || fileRecord.contentType || 'application/octet-stream';
        res.set('Content-Type', mimeType);
        if (fileRecord.length) {
            res.set('Content-Length', fileRecord.length);
        }
        const safeInlineName = fileRecord.filename.replace(/"/g, '');
        const encodedInlineName = encodeURIComponent(fileRecord.filename);
        res.set('Content-Disposition', `inline; filename="${safeInlineName}"; filename*=UTF-8''${encodedInlineName}`);

        const bucket = getGridFSBucket();
        const downloadStream = bucket.openDownloadStream(fileRecord._id);

        downloadStream.on('error', (err) => {
            if (!res.headersSent) {
                return res.status(404).json({ success: false, message: 'File stream error or file missing.' });
            }
            res.end();
        });

        downloadStream.pipe(res);
    } catch (error) {
        next(error);
    }
};

const downloadFileById = async (req, res, next) => {
    try {
        const fileId = req.params.id;
        const userId = req.user ? req.user._id.toString() : null;
        const fileRecord = await GridFSService.findFileById(fileId, userId);

        if (!fileRecord) {
            return res.status(404).json({ success: false, message: 'File not found or access denied.' });
        }

        const mimeType = (fileRecord.metadata && (fileRecord.metadata.contentType || fileRecord.metadata.mimeType)) || fileRecord.contentType || 'application/octet-stream';
        res.set('Content-Type', mimeType);
        if (fileRecord.length) {
            res.set('Content-Length', fileRecord.length);
        }
        const safeDownloadName = fileRecord.filename.replace(/"/g, '');
        const encodedDownloadName = encodeURIComponent(fileRecord.filename);
        res.set('Content-Disposition', `attachment; filename="${safeDownloadName}"; filename*=UTF-8''${encodedDownloadName}`);

        const bucket = getGridFSBucket();
        const downloadStream = bucket.openDownloadStream(fileRecord._id);

        downloadStream.on('error', (err) => {
            if (!res.headersSent) {
                return res.status(404).json({ success: false, message: 'File stream error or file missing.' });
            }
            res.end();
        });

        downloadStream.pipe(res);
    } catch (error) {
        next(error);
    }
};

const deleteFileById = async (req, res, next) => {
    try {
        const fileId = req.params.id;
        const userId = req.user ? req.user._id.toString() : null;
        const fileRecord = await GridFSService.findFileById(fileId, userId);

        if (!fileRecord) {
            return res.status(404).json({ success: false, message: 'File not found or access denied.' });
        }

        await GridFSService.deleteFile(fileId);

        res.status(200).json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    healthCheck,
    uploadFile,
    getFiles,
    getFileById,
    downloadFileById,
    deleteFileById
};