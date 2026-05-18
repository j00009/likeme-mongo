require('dotenv').config();
const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const Post = require('../models/Post');
const Interaction = require('../models/Interaction');

const recalculateUniqueViews = async () => {
    await connectDatabase();

    const uniqueViews = await Interaction.aggregate([
        { $match: { action: 'view' } },
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
                views: { $sum: 1 }
            }
        }
    ]);

    await Post.updateMany({}, { $set: { views: 0 } });

    let updated = 0;
    for (const item of uniqueViews) {
        const result = await Post.updateOne(
            { _id: item._id },
            { $set: { views: item.views } }
        );
        updated += result.modifiedCount;
    }

    console.log(`Views recalculadas para ${updated} posts.`);
    await mongoose.disconnect();
};

recalculateUniqueViews().catch(async (error) => {
    console.error('No se pudieron recalcular las views', error);
    await mongoose.disconnect();
    process.exit(1);
});
