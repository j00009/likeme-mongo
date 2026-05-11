const mongoose = require('mongoose');
const toJsonOptions = require('../utils/toJsonOptions');

const postSchema = new mongoose.Schema(
    {
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        autorNombre: {
            type: String,
            required: [true, 'El nombre del usuario es obligatorio'],
            trim: true,
            minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
            maxlength: [60, 'El nombre no puede superar 60 caracteres']
        },
        url: {
            type: String,
            required: [true, 'La URL de la imagen es obligatoria'],
            trim: true
        },
        descripcion: {
            type: String,
            required: [true, 'La descripcion es obligatoria'],
            trim: true,
            minlength: [2, 'La descripcion debe tener al menos 2 caracteres'],
            maxlength: [280, 'La descripcion no puede superar 280 caracteres']
        },
        likes: {
            type: Number,
            default: 0,
            min: 0
        },
        comentarios: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment'
        }]
    },
    { timestamps: true }
);

postSchema.set('toJSON', toJsonOptions);

module.exports = mongoose.model('Post', postSchema);
