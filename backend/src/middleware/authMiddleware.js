const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
        // Query param support for media preview streams & downloads in browser
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in with your email.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_gridfs_vault_jwt_key_2026');
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User belonging to this token no longer exists.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token. Please sign in again.'
        });
    }
};

module.exports = { protect };
