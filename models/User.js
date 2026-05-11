const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    }

});

userSchema.set('toJSON', {
    transform: (doc, ret) => {

        ret.id = ret._id.toString();

        delete ret._id;
        delete ret.__v;
        delete ret.password;
    }
});

module.exports = mongoose.model('User', userSchema);