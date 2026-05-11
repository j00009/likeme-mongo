const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { findOrCreateUser } = require('./userService');

const populateComment = (query) => {
    return query
        .populate('usuario', 'nombre email avatar')
        .populate('post', 'descripcion url');
};

const normalizeComment = (comment) => {
    if (!comment) return comment;

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

const listComments = async (postId) => {
    const filter = postId ? { post: postId } : {};
    const comments = await populateComment(Comment.find(filter).sort({ createdAt: 1 }));
    return comments.map(normalizeComment);
};

const getCommentById = async (id) => {
    const comment = await populateComment(Comment.findById(id));
    return normalizeComment(comment);
};

const createComment = async (payload) => {
    const user = await findOrCreateUser({
        nombre: payload.usuario || payload.nombre,
        email: payload.email,
        avatar: payload.avatar
    });

    const post = await Post.findById(payload.post);
    if (!post) return null;

    const comment = await Comment.create({
        post: post._id,
        usuario: user._id,
        autorNombre: user.nombre,
        texto: payload.texto
    });

    post.comentarios.push(comment._id);
    await post.save();

    return getCommentById(comment._id);
};

const updateComment = async (id, payload) => {
    await Comment.findByIdAndUpdate(
        id,
        { texto: payload.texto },
        { new: true, runValidators: true }
    );

    return getCommentById(id);
};

const deleteComment = async (id) => {
    const comment = await Comment.findByIdAndDelete(id);

    if (comment) {
        await Post.findByIdAndUpdate(comment.post, { $pull: { comentarios: comment._id } });
    }

    return normalizeComment(comment);
};

module.exports = {
    listComments,
    getCommentById,
    createComment,
    updateComment,
    deleteComment
};
