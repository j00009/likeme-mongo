const mongoose = require('mongoose');

const url = 'mongodb://127.0.0.1:27017/likeme';

mongoose.connect(url)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch(err => console.error("❌ Error al conectar", err));


const postSchema = new mongoose.Schema({
    usuario: String,
    url: String,
    descripcion: String,
    likes: { type: Number, default: 0 }
});

// Transformación para que el frontend reciba "id" en lugar de "_id"
postSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        return ret;
    }
});

// 3. Crear el Modelo
const Post = mongoose.model('Post', postSchema);

// --- FUNCIONES DE LA LÓGICA ---

const insertar = async (payload) => {
    const nuevoPost = new Post({
        usuario: payload.usuario,
        url: payload.URL, // El front envía URL en mayúsculas
        descripcion: payload.descripcion,
        likes: 0
    });
    return await nuevoPost.save();
}

const leer = async () => {
   
    return await Post.find().sort({ likes: -1, _id: 1 });
}

const actualizar = async (dato) => {
    const idSrt = typeof dato === 'object' ? dato.id : dato;

    const result = await Post.findByIdAndUpdate(
        idSrt, 
        { $inc: { likes: 1 } }, 
        { new: true }
    );
    return result;
};

module.exports = { insertar, leer, actualizar };