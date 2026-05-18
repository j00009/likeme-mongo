const mongoose = require('mongoose');
const toJsonOptions = require('../utils/toJsonOptions');

const commentSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: true
        },
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        autorNombre: {
            type: String,
            required: [true, 'El nombre del usuario es obligatorio'],
            trim: true
        },
        texto: {
            type: String,
            required: [true, 'El comentario es obligatorio'],
            trim: true,
            minlength: [1, 'El comentario no puede estar vacio'],
            maxlength: [180, 'El comentario no puede superar 180 caracteres']
        }
    },
    { timestamps: true }
);

commentSchema.set('toJSON', toJsonOptions);

module.exports = mongoose.model('Comment', commentSchema);
