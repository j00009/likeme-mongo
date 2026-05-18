require('dotenv').config();
const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const Post = require('../models/Post');
const Interaction = require('../models/Interaction');

const recalculateUniqueLikes = async () => {
    await connectDatabase();

    const uniqueLikes = await Interaction.aggregate([
        { $match: { action: 'like' } },
        {
            $group: {
                _id: {
                    post: '$post',
                    usuario: '$usuario'
                }
            }
        },
        {
            $group: {
                _id: '$_id.post',
                likes: { $sum: 1 }
            }
        }
    ]);

    await Post.updateMany({}, { $set: { likes: 0 } });

    let updated = 0;
    for (const item of uniqueLikes) {
        const result = await Post.updateOne(
            { _id: item._id },
            { $set: { likes: item.likes } }
        );
        updated += result.modifiedCount;
    }

    console.log(`Likes recalculados para ${updated} posts.`);
    await mongoose.disconnect();
};

recalculateUniqueLikes().catch(async (error) => {
    console.error('No se pudieron recalcular los likes', error);
    await mongoose.disconnect();
    process.exit(1);
});
