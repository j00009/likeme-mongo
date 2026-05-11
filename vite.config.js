const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
    plugins: [react()],
    publicDir: false,
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3001',
            '/posts': 'http://localhost:3001',
            '/post': 'http://localhost:3001',
            '/post-eliminar': 'http://localhost:3001'
        }
    }
});
