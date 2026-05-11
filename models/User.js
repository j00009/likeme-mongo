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
        }
    },
    { timestamps: true }
);

userSchema.set('toJSON', toJsonOptions);

module.exports = mongoose.model('User', userSchema);
