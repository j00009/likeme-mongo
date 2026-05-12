const express = require('express');
const path = require('path');
require('dotenv').config();

const connectDatabase = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const asyncHandler = require('./middlewares/asyncHandler');
const { requireAuth } = require('./middlewares/auth');
const postController = require('./controllers/postController');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');

const app = express();
const port = process.env.PORT || 3001;
const publicDir = path.join(__dirname, 'public');

connectDatabase();

app.use(express.json({ limit: '8mb' }));
app.use(express.static(publicDir));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// Rutas legacy conservadas para no romper la funcionalidad original.
app.get('/posts', asyncHandler(postController.listPosts));
app.post('/post', requireAuth, asyncHandler(postController.createPost));
app.put('/post', asyncHandler(postController.likePost));
app.delete('/post-eliminar', requireAuth, asyncHandler(postController.deletePost));

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

app.listen(port, () => {
    console.log(`App corriendo en http://localhost:${port}`);
});
