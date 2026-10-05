const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);

app.get('/', (req, res) => {
    res.json({ success: true, message: 'Welcome to File Uploader GridFS API Service' });
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

app.use(errorHandler);

module.exports = app;