const express = require('express');
const postController = require('../controllers/postController');
const asyncHandler = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(postController.listPosts));
router.get('/:id', asyncHandler(postController.getPost));
router.post('/', asyncHandler(postController.createPost));
router.put('/:id', asyncHandler(postController.updatePost));
router.patch('/:id/like', asyncHandler(postController.likePost));
router.delete('/:id', asyncHandler(postController.deletePost));

module.exports = router;
