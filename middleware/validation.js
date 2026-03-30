const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const sanitizeContent = (content) => {
    return sanitizeHtml(content, {
        allowedTags: ['b', 'i', 'em', 'strong', 'br'],
        allowedAttributes: {},
        allowedIframeHostnames: []
    });
};

const validateRegister = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('firstName').optional().trim().isLength({ max: 50 }),
    body('lastName').optional().trim().isLength({ max: 50 })
];

const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

const validatePart = [
    body('partName').trim().isLength({ min: 3, max: 100 }).withMessage('Part name must be 3-100 characters'),
    body('category').isIn(['CPU', 'GPU', 'Memory', 'Storage', 'Phone Parts', 'Motherboard', 'PSU', 'Cooler', 'Monitor', 'Other']),
    body('condition').isIn(['New', 'Used', 'Refurbished', 'For Parts']),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('description').optional().trim().isLength({ max: 2000 })
];

const validateMessage = [
    body('receiverId').isMongoId().withMessage('Valid receiver ID required'),
    body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters')
        .customSanitizer(value => sanitizeContent(value))
];

const validateReview = [
    body('revieweeId').isMongoId().withMessage('Valid reviewee ID required'),
    body('partId').optional().isMongoId(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment max 1000 characters')
        .customSanitizer(value => sanitizeContent(value))
];

const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

module.exports = {
    validateRegister,
    validateLogin,
    validatePart,
    validateMessage,
    validateReview,
    checkValidation
};