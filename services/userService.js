const User = require('../models/User');


const registrar = async (payload) => {

    const existe = await User.findOne({
        email: payload.email
    });

    if (existe) {
        throw new Error('El usuario ya existe');
    }

    const nuevoUsuario = new User({
        nombre: payload.nombre,
        email: payload.email,
        password: payload.password
    });

    return await nuevoUsuario.save();
};


const login = async (payload) => {

    const usuario = await User.findOne({
        email: payload.email,
        password: payload.password
    });

    if (!usuario) {
        throw new Error('Credenciales inválidas');
    }

    return usuario;
};


module.exports = {
    registrar,
    login
};