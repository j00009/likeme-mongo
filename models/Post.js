const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    usuario: { type: String, required: true },
    url: { type: String, required: true },
    descripcion: { type: String },
    likes: { type: Number, default: 0 }
});

module.exports = mongoose.model('Post', postSchema);