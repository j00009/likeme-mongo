const express = require('express')
const app = express()
const { insertar, leer, actualizar } = require('./db')
const dotenv = require('dotenv').config();

app.use(express.static("assets"))
app.use(express.json())

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html")
})

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
    const id = req.query;
    try {
        const response = await actualizar(id);
        res.send(response);
    } catch (error) {
        res.status(500).json({ error: 'No fue posible dar like al post.' })
    }
})

app.listen(3001, () => {
    console.log('App corriendo en http://localhost:3001')
})