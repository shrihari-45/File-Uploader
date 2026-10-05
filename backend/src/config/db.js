const mongoose = require('mongoose');

let gfsBucket;

const connectDB = async () => {
    try {
        const dbName = process.env.DATABASE_NAME || 'file_uploader_db';
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            dbName
        });

        // Initialize GridFS bucket
        const db = mongoose.connection.db;
        gfsBucket = new mongoose.mongo.GridFSBucket(db, {
            bucketName: 'uploads'
        });

        console.log(`MongoDB Connected: ${conn.connection.host} (Database: ${dbName})`);
        return gfsBucket;
    } catch (error) {
        console.error(`Database connection error: ${error.message}`);
        process.exit(1);
    }
};

const getGridFSBucket = () => {
    if (!gfsBucket) {
        throw new Error('GridFSBucket not initialized. Call connectDB first.');
    }
    return gfsBucket;
};

module.exports = { connectDB, getGridFSBucket };