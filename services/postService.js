const Post = require('../models/Post');

const insertar = async (payload) => {

    const nuevoPost = new Post({
        usuario: payload.usuario,
        usuarioId: payload.usuarioId,
        url: payload.url,
        descripcion: payload.descripcion,
        likes: 0
    });

    return await nuevoPost.save();
};

const leer = async () => {

    return await Post.find()
        .sort({ fecha: -1 });
};

const actualizar = async (id) => {

    return await Post.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { returnDocument: 'after' }
    );
};

const eliminar = async (id) => {

    return await Post.findByIdAndDelete(id);
};
const comentar = async (id, comentario) => {

    return await Post.findByIdAndUpdate(

        id,

        {
            $push: {
                comentarios: comentario
            }
        },

        {
            returnDocument: 'after'
        }
    );
};
const editar = async (id, payload) => {

    return await Post.findByIdAndUpdate(

        id,

        {
            descripcion: payload.descripcion,
            url: payload.url
        },

        {
            returnDocument: 'after'
        }
    );
};

module.exports = {
    insertar,
    leer,
    actualizar,
    eliminar,
    comentar,
    editar
};