const mongoose = require('mongoose');

const connectDatabase = async () => {
    const url = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/likeme';

    try {
        await mongoose.connect(url);
        console.log('Conectado a MongoDB');
    } catch (error) {
        console.error('Error al conectar con MongoDB', error);
        process.exit(1);
    }
};

module.exports = connectDatabase;
