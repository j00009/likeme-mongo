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
            trim: true,
            default: ''
        },
        mediaUrl: {
            type: String,
            trim: true
        },
        type: {
            type: String,
            enum: ['image', 'video', 'reel', 'text'],
            default: 'image'
        },
        tags: [{
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [32, 'Cada tag puede tener maximo 32 caracteres']
        }],
        views: {
            type: Number,
            default: 0,
            min: 0
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

postSchema.index({ tags: 1, createdAt: -1 });
postSchema.index({ views: -1, likes: -1 });

postSchema.set('toJSON', toJsonOptions);

module.exports = mongoose.model('Post', postSchema);
