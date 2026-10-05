const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId, email) => {
    return jwt.sign(
        { id: userId, email },
        process.env.JWT_SECRET || 'supersecret_gridfs_vault_jwt_key_2026',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email address already exists. Please sign in.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password
        });

        const token = generateToken(user._id, user.email);

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login with email and password
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Explicitly select password since it has select: false
        const user = await User.findOne({ email: normalizedEmail }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const token = generateToken(user._id, user.email);

        res.status(200).json({
            success: true,
            message: 'Signed in successfully!',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    res.status(200).json({
        success: true,
        user: {
            id: req.user._id.toString(),
            name: req.user.name,
            email: req.user.email,
            createdAt: req.user.createdAt
        }
    });
};

module.exports = {
    register,
    login,
    getMe
};
