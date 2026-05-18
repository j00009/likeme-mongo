const mongoose = require('mongoose');
const toJsonOptions = require('../utils/toJsonOptions');

const interactionSchema = new mongoose.Schema(
    {
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: true
        },
        action: {
            type: String,
            enum: ['view', 'like', 'comment'],
            required: true
        },
        tags: [{
            type: String,
            trim: true,
            lowercase: true
        }],
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

interactionSchema.index({ usuario: 1, createdAt: -1 });
interactionSchema.index({ usuario: 1, post: 1, action: 1 });
interactionSchema.index({ tags: 1 });

interactionSchema.set('toJSON', toJsonOptions);

module.exports = mongoose.model('Interaction', interactionSchema);
