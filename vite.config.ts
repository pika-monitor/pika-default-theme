import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({command}) => ({
    base: command === 'serve' ? '/' : '/t/',
    plugins: [react(), tailwindcss()],
    publicDir: path.resolve(import.meta.dirname, 'public'),
    resolve: {alias: {'@': path.resolve(import.meta.dirname, './src')}},
    build: {
        outDir: path.resolve(import.meta.dirname, 'dist'),
        emptyOutDir: true,
        assetsDir: 'assets',
    },
    server: {
        port: 5173,
        proxy: {'/api/': {target: 'http://localhost:8080/', changeOrigin: true}},
    },
}));
