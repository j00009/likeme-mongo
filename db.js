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


postSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        return ret;
    }
});

const Post = mongoose.model('Post', postSchema);


const insertar = async (payload) => {
    const nuevoPost = new Post({
        usuario: payload.usuario,
        url: payload.URL, 
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
const eliminar = async (dato) => {
    const id = typeof dato === 'object' ? dato.id : dato;

    const result = await Post .findByIdAndDelete(id)

    return result
}

module.exports = { insertar, leer, actualizar, eliminar};