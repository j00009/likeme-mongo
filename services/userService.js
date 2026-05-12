const User = require('../models/User');
const crypto = require('crypto');
const { signPayload } = require('../utils/authToken');

const avatarFor = (name) => {
    const encoded = encodeURIComponent(name.trim());
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encoded}&backgroundColor=2563eb,14b8a6,f97316,ec4899`;
};

const slugify = (value) => {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/(^\.|\.$)/g, '') || 'usuario';
};

const sanitizeUser = (user) => {
    if (!user) return user;
    const json = user.toJSON ? user.toJSON() : { ...user };
    delete json.passwordHash;
    delete json.passwordSalt;
    return json;
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    return { hash, salt };
};

const verifyPassword = (password, user) => {
    if (!user?.passwordHash || !user?.passwordSalt) return false;
    const { hash } = hashPassword(password, user.passwordSalt);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash));
};

const listUsers = () => {
    return User.find().sort({ createdAt: -1 });
};

const getUserById = (id) => {
    return User.findById(id);
};

const createUser = async (payload) => {
    const nombre = payload.nombre?.trim();
    const email = payload.email?.trim().toLowerCase() || `${slugify(nombre || 'usuario')}@likeme.local`;
    const avatar = payload.avatar?.trim() || avatarFor(nombre || email || 'Like Me');
    const credentials = payload.password ? hashPassword(payload.password) : {};

    try {
        return await User.create({
            nombre,
            email,
            avatar,
            passwordHash: credentials.hash,
            passwordSalt: credentials.salt
        });
    } catch (error) {
        if (error.code === 11000 && email) {
            return User.findOne({ email });
        }

        throw error;
    }
};

const createSession = (user) => {
    const cleanUser = sanitizeUser(user);
    return {
        user: cleanUser,
        token: signPayload({ id: cleanUser.id, email: cleanUser.email })
    };
};

const registerUser = async (payload) => {
    const nombre = payload.nombre?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();

    if (!nombre || !email || !password) {
        const error = new Error('Nombre, email y password son obligatorios');
        error.statusCode = 400;
        throw error;
    }

    if (password.length < 4) {
        const error = new Error('El password debe tener al menos 4 caracteres');
        error.statusCode = 400;
        throw error;
    }

    const existing = await User.findOne({ email }).select('+passwordHash +passwordSalt');
    if (existing?.passwordHash) {
        const error = new Error('Ese email ya esta registrado');
        error.statusCode = 409;
        throw error;
    }

    if (existing) {
        const credentials = hashPassword(password);
        existing.nombre = nombre;
        existing.avatar = payload.avatar?.trim() || existing.avatar || avatarFor(nombre);
        existing.passwordHash = credentials.hash;
        existing.passwordSalt = credentials.salt;
        await existing.save();
        return createSession(existing);
    }

    const user = await createUser({ ...payload, nombre, email, password });
    return createSession(user);
};

const loginUser = async ({ email, password }) => {
    const normalizedEmail = email?.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +passwordSalt');

    if (!user) {
        const error = new Error('Email o password incorrectos');
        error.statusCode = 401;
        throw error;
    }

    if (!user.passwordHash || !user.passwordSalt) {
        const error = new Error('Este usuario aun no tiene password. Entra por Registro con el mismo email para activarlo.');
        error.statusCode = 401;
        throw error;
    }

    if (!verifyPassword(password || '', user)) {
        const error = new Error('Email o password incorrectos');
        error.statusCode = 401;
        throw error;
    }

    return createSession(user);
};

const findOrCreateUser = async ({ nombre, email, avatar }) => {
    const normalizedName = nombre?.trim();
    const normalizedEmail = email?.trim().toLowerCase() || `${slugify(normalizedName || 'usuario')}@likeme.local`;

    if (!normalizedName) {
        const error = new Error('El nombre del usuario es obligatorio');
        error.statusCode = 400;
        throw error;
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        user = await createUser({
            nombre: normalizedName,
            email: normalizedEmail,
            avatar
        });
    } else if (avatar && user.avatar !== avatar) {
        user.avatar = avatar;
        await user.save();
    }

    return user;
};

const updateUser = (id, payload) => {
    return User.findByIdAndUpdate(
        id,
        {
            nombre: payload.nombre,
            email: payload.email,
            avatar: payload.avatar
        },
        { new: true, runValidators: true }
    );
};

const deleteUser = (id) => {
    return User.findByIdAndDelete(id);
};

module.exports = {
    listUsers,
    getUserById,
    createUser,
    registerUser,
    loginUser,
    sanitizeUser,
    findOrCreateUser,
    updateUser,
    deleteUser
};
