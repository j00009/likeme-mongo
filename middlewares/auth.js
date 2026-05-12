const User = require('../models/User');
const { verifyToken } = require('../utils/authToken');

const requireAuth = async (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyToken(token);

    if (!payload?.id) {
        return res.status(401).json({ error: 'Debes iniciar sesion' });
    }

    const user = await User.findById(payload.id);
    if (!user) {
        return res.status(401).json({ error: 'Sesion invalida' });
    }

    req.user = user;
    next();
};

module.exports = {
    requireAuth
};
