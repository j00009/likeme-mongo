const express = require('express');
const commentController = require('../controllers/commentController');
const asyncHandler = require('../middlewares/asyncHandler');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', asyncHandler(commentController.listComments));
router.get('/:id', asyncHandler(commentController.getComment));
router.post('/', requireAuth, asyncHandler(commentController.createComment));
router.put('/:id', requireAuth, asyncHandler(commentController.updateComment));
router.delete('/:id', requireAuth, asyncHandler(commentController.deleteComment));

module.exports = router;
