const express = require('express');
const commentController = require('../controllers/commentController');
const asyncHandler = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(commentController.listComments));
router.get('/:id', asyncHandler(commentController.getComment));
router.post('/', asyncHandler(commentController.createComment));
router.put('/:id', asyncHandler(commentController.updateComment));
router.delete('/:id', asyncHandler(commentController.deleteComment));

module.exports = router;
