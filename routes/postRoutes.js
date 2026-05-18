const express = require('express');
const postController = require('../controllers/postController');
const asyncHandler = require('../middlewares/asyncHandler');
const { optionalAuth, requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', optionalAuth, asyncHandler(postController.listPosts));
router.get('/clusters', optionalAuth, asyncHandler(postController.listPostClusters));
router.get('/following', requireAuth, asyncHandler(postController.listFollowingPosts));
router.get('/user/:id', optionalAuth, asyncHandler(postController.listPostsByUser));
router.get('/:id', asyncHandler(postController.getPost));
router.post('/', requireAuth, asyncHandler(postController.createPost));
router.put('/:id', requireAuth, asyncHandler(postController.updatePost));
router.patch('/:id/like', requireAuth, asyncHandler(postController.likePost));
router.patch('/:id/view', optionalAuth, asyncHandler(postController.viewPost));
router.delete('/:id', requireAuth, asyncHandler(postController.deletePost));

module.exports = router;
