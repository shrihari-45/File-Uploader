const mongoose = require('mongoose');
const { getGridFSBucket } = require('../config/db');

class GridFSService {
    static async findAllFiles(userId) {
        const bucket = getGridFSBucket();
        const filter = userId ? { 'metadata.userId': userId } : {};
        return await bucket.find(filter).sort({ uploadDate: -1 }).toArray();
    }

    static async findFileById(id, userId) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const bucket = getGridFSBucket();
        const query = { _id: new mongoose.Types.ObjectId(id) };
        if (userId) {
            query['metadata.userId'] = userId;
        }
        const files = await bucket.find(query).toArray();
        return files[0] || null;
    }

    static async deleteFile(id) {
        const bucket = getGridFSBucket();
        const fileId = new mongoose.Types.ObjectId(id);
        await bucket.delete(fileId);
    }
}

module.exports = GridFSService;