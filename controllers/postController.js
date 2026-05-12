const postService = require('../services/postService');
const { isValidObjectId } = require('../utils/validators');

const hasPostPayload = (body) => {
    return Boolean((body.URL || body.url) && body.descripcion);
};

const listPosts = async (req, res) => {
    const posts = await postService.listPosts();
    res.json(posts);
};

const getPost = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de post invalido' });
    }

    const post = await postService.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });

    res.json(post);
};

const createPost = async (req, res) => {
    if (!hasPostPayload(req.body)) {
        return res.status(400).json({ error: 'URL y descripcion son obligatorios' });
    }

    const post = await postService.createPost(req.body, req.user);
    res.status(201).json(post);
};

const updatePost = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'ID de post invalido' });
    }

    const post = await postService.updatePost(req.params.id, req.body, req.user);
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });

    res.json(post);
};

const likePost = async (req, res) => {
    const id = req.params.id || req.query.id;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ error: 'ID de post invalido' });
    }

    const post = await postService.likePost(id);
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });

    res.json(post);
};

const deletePost = async (req, res) => {
    const id = req.params.id || req.query.id;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ error: 'ID de post invalido' });
    }

    const post = await postService.deletePost(id, req.user);
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });

    res.json(post);
};

module.exports = {
    listPosts,
    getPost,
    createPost,
    updatePost,
    likePost,
    deletePost
};
