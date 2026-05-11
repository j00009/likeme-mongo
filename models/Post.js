const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({

    usuario: {
        type: String,
        required: true
    },

    usuarioId: {
        type: String,
        required: true
    },

    url: {
        type: String,
        required: true
    },

    descripcion: {
        type: String
    },

    likes: {
        type: Number,
        default: 0
    },

    comentarios: [
        {
            usuario: String,
            texto: String
        }
    ],

    fecha: {
        type: Date,
        default: Date.now
    }

});

postSchema.set('toJSON', {
    transform: (doc, ret) => {

        ret.id = ret._id.toString();

        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('Post', postSchema);
