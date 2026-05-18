const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Interaction = require('../models/Interaction');
const { findOrCreateUser } = require('./userService');

const postPopulation = [
    { path: 'usuario', select: 'nombre email avatar bio interests role' },
    {
        path: 'comentarios',
        populate: { path: 'usuario', select: 'nombre email avatar' },
        options: { sort: { createdAt: 1 } }
    }
];

const allowedTypes = ['image', 'video', 'reel', 'text'];
const VIEW_COOLDOWN_MS = 30 * 1000;

const normalizeTags = (value) => {
    const rawTags = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return [...new Set(rawTags
        .map((tag) => tag.toString().trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean))]
        .slice(0, 8);
};

const normalizeType = (type, mediaUrl) => {
    if (allowedTypes.includes(type)) return type;
    return mediaUrl ? 'image' : 'text';
};

const normalizeExternalUrl = (value) => {
    const url = value?.toString?.().trim() || '';
    if (!url || url.startsWith('data:') || url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
};

const normalizeEmbeddedComment = (comment) => {
    const json = comment.toJSON ? comment.toJSON() : comment;

    if (json.usuario && typeof json.usuario === 'object') {
        json.autor = json.usuario;
        json.usuario = json.usuario.nombre;
        json.avatar = json.autor.avatar;
    } else {
        json.usuario = json.autorNombre;
    }

    return json;
};

const normalizePost = (post) => {
    if (!post) return post;

    const json = post.toJSON ? post.toJSON() : post;

    if (json.usuario && typeof json.usuario === 'object') {
        json.autor = json.usuario;
        json.usuario = json.usuario.nombre;
        json.avatar = json.autor.avatar;
        json.ownerId = json.autor.id;
    } else {
        json.ownerId = json.usuario?.toString?.() || json.usuario;
        json.usuario = json.autorNombre;
    }

    json.mediaUrl = json.mediaUrl || json.url || '';
    json.url = json.url || json.mediaUrl || '';
    json.type = json.type || (json.mediaUrl ? 'image' : 'text');
    json.tags = json.tags || [];
    json.views = json.views || 0;
    json.comentarios = (json.comentarios || []).map(normalizeEmbeddedComment);
    return json;
};

const normalizePostsWithUserState = async (posts, currentUser) => {
    const normalizedPosts = posts.map(normalizePost);
    if (!currentUser || normalizedPosts.length === 0) return normalizedPosts;

    const likedPostIds = await Interaction.find({
        usuario: currentUser._id,
        action: 'like',
        post: { $in: normalizedPosts.map((post) => post.id) }
    }).distinct('post');

    const likedSet = new Set(likedPostIds.map((id) => id.toString()));
    return normalizedPosts.map((post) => ({
        ...post,
        likedByCurrentUser: likedSet.has(post.id)
    }));
};

const getUserPreferenceTags = async (currentUser) => {
    if (!currentUser) return [];

    const interactionTags = await Interaction.aggregate([
        { $match: { usuario: currentUser._id } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', score: { $sum: 1 } } },
        { $sort: { score: -1 } },
        { $limit: 12 }
    ]);

    return [...new Set([
        ...(currentUser.interests || []),
        ...interactionTags.map((item) => item._id)
    ].filter(Boolean))];
};

const scorePostForTags = (post, preferredTags) => {
    const tagScore = (post.tags || []).filter((tag) => preferredTags.includes(tag)).length;
    const popularityScore = Math.min((post.likes || 0) + (post.views || 0) / 5, 30) / 100;
    return tagScore * 10 + popularityScore;
};

const sortRecommendedPosts = (posts, preferredTags) => {
    if (!preferredTags.length) {
        return posts.sort((a, b) => {
            const bPopularity = (b.likes || 0) * 3 + (b.views || 0) + (b.comentarios?.length || 0) * 2;
            const aPopularity = (a.likes || 0) * 3 + (a.views || 0) + (a.comentarios?.length || 0) * 2;
            return bPopularity - aPopularity || new Date(b.createdAt) - new Date(a.createdAt);
        });
    }

    return posts.sort((a, b) => {
        return scorePostForTags(b, preferredTags) - scorePostForTags(a, preferredTags)
            || new Date(b.createdAt) - new Date(a.createdAt);
    });
};

const sortPostsByIdList = (posts, ids) => {
    const positions = new Map(ids.map((id, index) => [id.toString(), index]));
    return posts.sort((a, b) => {
        return (positions.get(a._id.toString()) ?? 0) - (positions.get(b._id.toString()) ?? 0);
    });
};

const listPosts = async (currentUser) => {
    const posts = await Post.find()
        .populate(postPopulation)
        .sort({ createdAt: -1 });

    const normalizedPosts = await normalizePostsWithUserState(posts, currentUser);
    const preferredTags = await getUserPreferenceTags(currentUser);
    return sortRecommendedPosts(normalizedPosts, preferredTags);
};

const listFollowingPosts = async (currentUser) => {
    if (!currentUser) {
        const error = new Error('Debes iniciar sesion');
        error.statusCode = 401;
        throw error;
    }

    const following = currentUser.following || [];
    if (following.length === 0) return [];

    const posts = await Post.find({ usuario: { $in: following } })
        .populate(postPopulation)
        .sort({ createdAt: -1 });

    return normalizePostsWithUserState(posts, currentUser);
};

const listPostsByUser = async (userId, currentUser) => {
    const posts = await Post.find({ usuario: userId })
        .populate(postPopulation)
        .sort({ createdAt: -1 });

    return normalizePostsWithUserState(posts, currentUser);
};

const listPostClusters = async (currentUser) => {
    const preferredTags = await getUserPreferenceTags(currentUser);
    const clusters = await Post.aggregate([
        {
            $addFields: {
                normalizedTags: {
                    $cond: [
                        { $gt: [{ $size: { $ifNull: ['$tags', []] } }, 0] },
                        '$tags',
                        ['recientes']
                    ]
                },
                popularity: {
                    $add: [
                        { $multiply: ['$likes', 3] },
                        '$views',
                        { $multiply: [{ $size: { $ifNull: ['$comentarios', []] } }, 2] }
                    ]
                }
            }
        },
        { $unwind: '$normalizedTags' },
        {
            $addFields: {
                recommendedTag: { $in: ['$normalizedTags', preferredTags] }
            }
        },
        { $sort: { recommendedTag: -1, popularity: -1, createdAt: -1 } },
        {
            $group: {
                _id: '$normalizedTags',
                postIds: { $push: '$_id' },
                totalPosts: { $sum: 1 },
                totalViews: { $sum: '$views' },
                totalLikes: { $sum: '$likes' },
                recommended: { $max: '$recommendedTag' },
                latestPostAt: { $max: '$createdAt' }
            }
        },
        {
            $addFields: {
                score: {
                    $add: [
                        { $cond: ['$recommended', 1000, 0] },
                        { $multiply: ['$totalPosts', 8] },
                        { $multiply: ['$totalLikes', 3] },
                        '$totalViews'
                    ]
                },
                postIds: { $slice: ['$postIds', 10] }
            }
        },
        { $sort: { score: -1, latestPostAt: -1 } },
        { $limit: 8 }
    ]);

    const result = [];
    for (const cluster of clusters) {
        const posts = await Post.find({ _id: { $in: cluster.postIds } })
            .populate(postPopulation);

        result.push({
            tag: cluster._id,
            title: `#${cluster._id}`,
            recommended: cluster.recommended,
            totalPosts: cluster.totalPosts,
            totalViews: cluster.totalViews,
            totalLikes: cluster.totalLikes,
            posts: await normalizePostsWithUserState(sortPostsByIdList(posts, cluster.postIds), currentUser)
        });
    }

    return result.filter((cluster) => cluster.posts.length > 0);
};

const getPostById = async (id, currentUser = null) => {
    const post = await Post.findById(id).populate(postPopulation);
    const [normalizedPost] = await normalizePostsWithUserState(post ? [post] : [], currentUser);
    return normalizedPost || null;
};

const createPost = async (payload, currentUser) => {
    const user = currentUser || await findOrCreateUser({
        nombre: payload.usuario || payload.nombre,
        email: payload.email,
        avatar: payload.avatar
    });
    const mediaUrl = normalizeExternalUrl(payload.mediaUrl || payload.URL || payload.url || '');
    const type = normalizeType(payload.type, mediaUrl);
    const post = await Post.create({
        usuario: user._id,
        autorNombre: user.nombre,
        url: mediaUrl,
        mediaUrl,
        type,
        tags: normalizeTags(payload.tags),
        descripcion: payload.descripcion,
        likes: payload.likes || 0
    });

    return getPostById(post._id, currentUser);
};

const assertPostOwner = async (id, currentUser) => {
    const post = await Post.findById(id);
    if (!post) return null;

    if (!currentUser || post.usuario.toString() !== currentUser._id.toString()) {
        const error = new Error('Solo puedes modificar publicaciones creadas por tu usuario');
        error.statusCode = 403;
        throw error;
    }

    return post;
};

const updatePost = async (id, payload, currentUser) => {
    await assertPostOwner(id, currentUser);
    const update = {};

    if (payload.URL || payload.url || payload.mediaUrl) {
        update.mediaUrl = normalizeExternalUrl(payload.mediaUrl || payload.URL || payload.url);
        update.url = update.mediaUrl;
    }
    if (payload.type) update.type = normalizeType(payload.type, update.mediaUrl);
    if (Object.prototype.hasOwnProperty.call(payload, 'tags')) update.tags = normalizeTags(payload.tags);
    if (payload.descripcion) update.descripcion = payload.descripcion;

    await Post.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true });
    return getPostById(id);
};

const recordInteraction = async (post, currentUser, action, metadata = {}) => {
    if (!post || !currentUser) return;

    await Interaction.create({
        usuario: currentUser._id,
        post: post._id,
        action,
        tags: post.tags || [],
        metadata
    });
};

const likePost = async (id, currentUser) => {
    const basePost = await Post.findById(id);
    if (!basePost) return null;

    if (!currentUser) {
        const error = new Error('Debes iniciar sesion para dar like');
        error.statusCode = 401;
        throw error;
    }

    const existingLike = await Interaction.findOne({
        usuario: currentUser._id,
        post: basePost._id,
        action: 'like'
    });

    if (existingLike) return getPostById(id, currentUser);

    await Post.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { returnDocument: 'after', runValidators: true }
    );
    await recordInteraction(basePost, currentUser, 'like');

    return getPostById(id, currentUser);
};

const viewPost = async (id, currentUser) => {
    const post = await Post.findById(id);
    if (!post) return null;

    if (!currentUser) return getPostById(id, currentUser);

    const lastView = await Interaction.findOne({
        usuario: currentUser._id,
        post: post._id,
        action: 'view'
    }).sort({ createdAt: -1 });

    const now = Date.now();
    const recentlyViewed = lastView && now - lastView.createdAt.getTime() < VIEW_COOLDOWN_MS;
    if (recentlyViewed) return getPostById(id, currentUser);

    const isFirstView = !lastView;
    if (isFirstView) {
        await Post.findByIdAndUpdate(
            id,
            { $inc: { views: 1 } },
            { returnDocument: 'after', runValidators: true }
        );
    }

    await recordInteraction(post, currentUser, 'view', {
        counted: isFirstView,
        cooldownSeconds: VIEW_COOLDOWN_MS / 1000
    });
    return getPostById(id, currentUser);
};

const deletePost = async (id, currentUser) => {
    await assertPostOwner(id, currentUser);
    const post = await Post.findByIdAndDelete(id);
    if (post) {
        await Comment.deleteMany({ post: post._id });
    }

    return normalizePost(post);
};

module.exports = {
    listPosts,
    listFollowingPosts,
    listPostsByUser,
    listPostClusters,
    getPostById,
    createPost,
    updatePost,
    likePost,
    viewPost,
    recordInteraction,
    normalizeTags,
    deletePost
};
