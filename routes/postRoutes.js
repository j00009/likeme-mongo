const express = require('express');
const postController = require('../controllers/postController');
const asyncHandler = require('../middlewares/asyncHandler');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', asyncHandler(postController.listPosts));
router.get('/:id', asyncHandler(postController.getPost));
router.post('/', requireAuth, asyncHandler(postController.createPost));
router.put('/:id', requireAuth, asyncHandler(postController.updatePost));
router.patch('/:id/like', asyncHandler(postController.likePost));
router.delete('/:id', requireAuth, asyncHandler(postController.deletePost));

module.exports = router;
