const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { findOrCreateUser } = require('./userService');

const postPopulation = [
    { path: 'usuario', select: 'nombre email avatar' },
    {
        path: 'comentarios',
        populate: { path: 'usuario', select: 'nombre email avatar' },
        options: { sort: { createdAt: 1 } }
    }
];

const normalizeEmbeddedComment = (comment) => {
    const json = comment.toJSON ? comment.toJSON() : comment;

    if (json.usuario && typeof json.usuario === 'object') {
        json.autor = json.usuario;
        json.usuario = json.usuario.nombre;
        json.avatar = json.autor.avatar;
    } else {
        json.usuario = json.autorNombre;
    }

    return json;
};

const normalizePost = (post) => {
    if (!post) return post;

    const json = post.toJSON ? post.toJSON() : post;

    if (json.usuario && typeof json.usuario === 'object') {
        json.autor = json.usuario;
        json.usuario = json.usuario.nombre;
        json.avatar = json.autor.avatar;
        json.ownerId = json.autor.id;
    } else {
        json.ownerId = json.usuario?.toString?.() || json.usuario;
        json.usuario = json.autorNombre;
    }

    json.comentarios = (json.comentarios || []).map(normalizeEmbeddedComment);
    return json;
};

const listPosts = async () => {
    const posts = await Post.find()
        .populate(postPopulation)
        .sort({ createdAt: -1 });

    return posts.map(normalizePost);
};

const getPostById = async (id) => {
    const post = await Post.findById(id).populate(postPopulation);
    return normalizePost(post);
};

const createPost = async (payload, currentUser) => {
    const user = currentUser || await findOrCreateUser({
        nombre: payload.usuario || payload.nombre,
        email: payload.email,
        avatar: payload.avatar
    });
    const post = await Post.create({
        usuario: user._id,
        autorNombre: user.nombre,
        url: payload.URL || payload.url,
        descripcion: payload.descripcion,
        likes: payload.likes || 0
    });

    return getPostById(post._id);
};

const assertPostOwner = async (id, currentUser) => {
    const post = await Post.findById(id);
    if (!post) return null;

    if (!currentUser || post.usuario.toString() !== currentUser._id.toString()) {
        const error = new Error('Solo puedes modificar publicaciones creadas por tu usuario');
        error.statusCode = 403;
        throw error;
    }

    return post;
};

const updatePost = async (id, payload, currentUser) => {
    await assertPostOwner(id, currentUser);
    const update = {};

    if (payload.URL || payload.url) update.url = payload.URL || payload.url;
    if (payload.descripcion) update.descripcion = payload.descripcion;

    await Post.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    return getPostById(id);
};

const likePost = async (id) => {
    await Post.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { new: true, runValidators: true }
    );

    return getPostById(id);
};

const deletePost = async (id, currentUser) => {
    await assertPostOwner(id, currentUser);
    const post = await Post.findByIdAndDelete(id);
    if (post) {
        await Comment.deleteMany({ post: post._id });
    }

    return normalizePost(post);
};

module.exports = {
    listPosts,
    getPostById,
    createPost,
    updatePost,
    likePost,
    deletePost
};
