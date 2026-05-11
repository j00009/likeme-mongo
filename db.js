const postService = require('./services/postService');

const insertar = (payload) => postService.createPost(payload);
const leer = () => postService.listPosts();
const actualizar = (dato) => postService.likePost(typeof dato === 'object' ? dato.id : dato);
const eliminar = (dato) => postService.deletePost(typeof dato === 'object' ? dato.id : dato);

module.exports = { insertar, leer, actualizar, eliminar };
