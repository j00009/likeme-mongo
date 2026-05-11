const User = require('../models/User');

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

    try {
        return await User.create({ nombre, email, avatar });
    } catch (error) {
        if (error.code === 11000 && email) {
            return User.findOne({ email });
        }

        throw error;
    }
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
    findOrCreateUser,
    updateUser,
    deleteUser
};
