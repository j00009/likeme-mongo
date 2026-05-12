const express = require('express');
const userController = require('../controllers/userController');
const asyncHandler = require('../middlewares/asyncHandler');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', asyncHandler(userController.listUsers));
router.post('/register', asyncHandler(userController.register));
router.post('/login', asyncHandler(userController.login));
router.get('/me', requireAuth, asyncHandler(userController.me));
router.get('/:id', asyncHandler(userController.getUser));
router.post('/', asyncHandler(userController.createUser));
router.put('/:id', asyncHandler(userController.updateUser));
router.delete('/:id', asyncHandler(userController.deleteUser));

module.exports = router;
