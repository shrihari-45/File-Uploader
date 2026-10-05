const multer = require('multer');

const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message || 'Internal Server Error';

    if (err instanceof multer.MulterError) {
        statusCode = 400;
        if (err.code === 'LIMIT_FILE_SIZE') {
            statusCode = 413;
            message = 'File too large. Maximum size permitted is 10MB.';
        } else {
            message = `Upload error: ${err.message}`;
        }
    } else if (err.message && (err.message.includes('Security restriction') || err.message.includes('Unsupported file format'))) {
        statusCode = 400;
    }

    if (err.name === 'BSONError' || err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid file identifier format provided.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = errorHandler;