const express = require('express')
const app = express()
const { error } = require('node:console');
const dotenv = require('dotenv').config();

require('./db');
const {
    insertar,
    leer,
    actualizar,
    eliminar,
    comentar,
    editar
} = require('./services/postService');

const {
    registrar,
    login
} = require('./services/userService');

app.use(express.static("assets"))
app.use(express.json())

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html")
})

app.post('/registro', async (req, res) => {

    try {

        const response = await registrar(req.body);

        res.status(201).send(response);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

app.post('/login', async (req, res) => {

    try {

        const response = await login(req.body);

        res.send(response);

    } catch (error) {

        res.status(401).json({
            error: error.message
        });

    }

});

app.post("/post", async (req, res) => {
    const payload = req.body
    try {
        const response = await insertar(payload)
        // Mongoose devuelve el documento directamente, no hay .rows
        res.status(201).send(response) 
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Algo salió mal" })
    }
})

app.get("/posts", async (req, res) => {
    try {
        const response = await leer()
        // response ya es el array de posts
        res.send(response) 
    } catch (error) {
        res.status(500).json({ error: "Algo salió mal" })
    }
})

app.put("/post", async (req, res) => {
    const { id } = req.query;
    try {
        const response = await actualizar(id);
        res.send(response);
    } catch (error) {
        res.status(500).json({ error: 'No fue posible dar like al post.' })
    }
})

app.post('/comentario/:id', async (req, res) => {

    const { id } = req.params;

    try {

        const response = await comentar(
            id,
            req.body
        );

        res.send(response);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: 'No se pudo comentar'
        });

    }

});
app.put('/editar-post/:id', async (req, res) => {

    try {

        const response = await editar(
            req.params.id,
            req.body
        );

        res.send(response);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: 'No se pudo editar'
        });

    }

});

app.delete("/post-eliminar", async (req, res) => {

    const { id } = req.query;

    try {

        const response = await eliminar(id);

        res.send(response);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: 'No se pudo eliminar el post'
        });

    }

});



app.listen(3001, () => {
    console.log('App corriendo en http://localhost:3001')
})