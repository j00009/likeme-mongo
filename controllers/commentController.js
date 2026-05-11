const commentService = require('../services/commentService');
const { isValidObjectId } = require('../utils/validators');

const listComments = async (req, res) => {
    const { post } = req.query;

    if (post && !isValidObjectId(post)) {
        return res.status(400).json({ error: 'ID de post invalido' });
    }

    const comments = await commentService.listComments(post);
    res.json(comments);
};

const getComment = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de comentario invalido' });
    }

    const comment = await commentService.getCommentById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });

    res.json(comment);
};

const createComment = async (req, res) => {
    if (!req.body.post || !isValidObjectId(req.body.post)) {
        return res.status(400).json({ error: 'ID de post invalido' });
    }

    if (!(req.body.usuario || req.body.nombre) || !req.body.texto) {
        return res.status(400).json({ error: 'Usuario y texto son obligatorios' });
    }

    const comment = await commentService.createComment(req.body);
    if (!comment) return res.status(404).json({ error: 'Post no encontrado' });

    res.status(201).json(comment);
};

const updateComment = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de comentario invalido' });
    }

    if (!req.body.texto) {
        return res.status(400).json({ error: 'El texto es obligatorio' });
    }

    const comment = await commentService.updateComment(req.params.id, req.body);
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });

    res.json(comment);
};

const deleteComment = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de comentario invalido' });
    }

    const comment = await commentService.deleteComment(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });

    res.json(comment);
};

module.exports = {
    listComments,
    getComment,
    createComment,
    updateComment,
    deleteComment
};
