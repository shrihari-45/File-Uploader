const multer = require('multer');

const path = require('path');

const storage = multer.memoryStorage();

// Block dangerous executable binaries for security
const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', '.ps1', '.com'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (dangerousExtensions.includes(ext)) {
        return cb(new Error(`Security restriction: Executable files (${ext}) are not permitted.`), false);
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB Limit
    }
});

module.exports = upload;