const userService = require('../services/userService');
const { isValidObjectId } = require('../utils/validators');

const listUsers = async (req, res) => {
    const users = await userService.listUsers();
    res.json(users);
};

const getUser = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de usuario invalido' });
    }

    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
};

const createUser = async (req, res) => {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
};

const register = async (req, res) => {
    const session = await userService.registerUser(req.body);
    res.status(201).json(session);
};

const login = async (req, res) => {
    const session = await userService.loginUser(req.body);
    res.json(session);
};

const me = async (req, res) => {
    res.json(userService.sanitizeUser(req.user));
};

const updateMe = async (req, res) => {
    const user = await userService.updateCurrentUser(req.user, req.body);
    res.json(user);
};

const updateUser = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de usuario invalido' });
    }

    const user = await userService.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
};

const deleteUser = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de usuario invalido' });
    }

    const user = await userService.deleteUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
};

const followUser = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de usuario invalido' });
    }

    const user = await userService.followUser(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
};

const unfollowUser = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de usuario invalido' });
    }

    const user = await userService.unfollowUser(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
};

module.exports = {
    listUsers,
    getUser,
    createUser,
    register,
    login,
    me,
    updateMe,
    updateUser,
    followUser,
    unfollowUser,
    deleteUser
};
