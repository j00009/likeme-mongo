const mongoose = require('mongoose');
const toJsonOptions = require('../utils/toJsonOptions');

const userSchema = new mongoose.Schema(
    {
        nombre: {
            type: String,
            required: [true, 'El nombre es obligatorio'],
            trim: true,
            minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
            maxlength: [60, 'El nombre no puede superar 60 caracteres']
        },
        email: {
            type: String,
            required: [true, 'El email es obligatorio'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'El email no es valido']
        },
        avatar: {
            type: String,
            trim: true,
            default: ''
        },
        bio: {
            type: String,
            trim: true,
            maxlength: [180, 'La bio no puede superar 180 caracteres'],
            default: ''
        },
        interests: [{
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [32, 'Cada interes puede tener maximo 32 caracteres']
        }],
        following: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        passwordHash: {
            type: String,
            select: false
        },
        passwordSalt: {
            type: String,
            select: false
        }
    },
    { timestamps: true }
);

userSchema.index({ interests: 1 });
userSchema.index({ following: 1 });

userSchema.set('toJSON', toJsonOptions);

module.exports = mongoose.model('User', userSchema);
