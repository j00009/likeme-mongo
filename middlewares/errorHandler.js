const errorHandler = (error, req, res, next) => {
    console.error(error);

    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'La imagen es demasiado pesada. Usa una imagen mas liviana.' });
    }

    if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
    }

    if (error.name === 'ValidationError') {
        const details = Object.values(error.errors).map((item) => item.message);
        return res.status(400).json({ error: 'Datos invalidos', details });
    }

    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Identificador invalido' });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = errorHandler;
