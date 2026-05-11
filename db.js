const mongoose = require('mongoose');

const url = 'mongodb://127.0.0.1:27017/likeme';

mongoose.connect(url)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch(err => console.error("❌ Error al conectar", err));

module.exports = mongoose;