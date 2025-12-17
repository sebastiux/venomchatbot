#!/usr/bin/env node
/**
 * Script para limpiar sesiones y logs de Baileys/WhatsApp
 * Ejecutar: npm run clean
 *
 * Esto eliminará:
 * - Carpetas *_sessions (sesiones de Baileys)
 * - Archivos *.log
 * - Archivos QR PNG
 * - Archivos de caché de WhatsApp
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Patrones de archivos/carpetas a eliminar
const patterns = [
    // Carpetas de sesión
    '*_sessions',
    'bot_sessions',
    'sessions',
    '.wwebjs_auth',
    '.wwebjs_cache',
    // Archivos de log
    '*.log',
    // QR codes
    '*qr.png',
    'qr.png',
    // Tokens
    '*tokens',
    // Temporales de Baileys
    'baileys_*',
    'auth_info*',
];

function deletePath(targetPath) {
    try {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
            console.log(`  🗑️  Carpeta eliminada: ${path.basename(targetPath)}`);
        } else {
            fs.unlinkSync(targetPath);
            console.log(`  🗑️  Archivo eliminado: ${path.basename(targetPath)}`);
        }
        return true;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`  ❌ Error eliminando ${targetPath}: ${error.message}`);
        }
        return false;
    }
}

function matchesPattern(filename, pattern) {
    // Convertir el patrón glob simple a regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(filename);
}

function cleanDirectory(dir) {
    let cleaned = 0;

    try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const itemPath = path.join(dir, item);

            for (const pattern of patterns) {
                if (matchesPattern(item, pattern)) {
                    if (deletePath(itemPath)) {
                        cleaned++;
                    }
                    break;
                }
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Error leyendo directorio ${dir}: ${error.message}`);
        }
    }

    return cleaned;
}

console.log('\n🧹 LIMPIEZA DE SESIONES Y LOGS\n');
console.log('=' .repeat(50));

const cleaned = cleanDirectory(rootDir);

console.log('=' .repeat(50));

if (cleaned === 0) {
    console.log('\n✅ No hay archivos para limpiar\n');
} else {
    console.log(`\n✅ ${cleaned} elemento(s) eliminado(s)\n`);
    console.log('💡 Ahora puedes ejecutar: npm start');
    console.log('   Se generará un nuevo código QR\n');
}
