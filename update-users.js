const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function updateUsers() {
    try {
        const db = await open({
            filename: './database/cobro.db',
            driver: sqlite3.Database
        });

        // Eliminar usuarios existentes
        await db.run('DELETE FROM usuarios');

        // Nuevos usuarios
        const nuevosUsuarios = [
            { nombre: 'Pablo Vazquez', codigo: 'Pablo', password: 'pablo2503' },
            { nombre: 'Patricia Britez', codigo: 'Pato', password: 'pato2026' },
            { nombre: 'Andres Segovia', codigo: 'ivan', password: 'ivan26' },
            { nombre: 'Alcides Saavedra', codigo: 'Alcides', password: 'alcides26' },
            { nombre: 'Esteban Britez', codigo: 'capeli', password: 'capeli26' }
        ];

        for (const usuario of nuevosUsuarios) {
            const hash = await bcrypt.hash(usuario.password, 10);
            await db.run(`
                INSERT INTO usuarios (nombre, email, password, codigo_cobrador) 
                VALUES (?, ?, ?, ?)
            `, [
                usuario.nombre,
                `${usuario.codigo.toLowerCase()}@cobro.com`,
                hash,
                usuario.codigo
            ]);
            console.log(`✅ Creado: ${usuario.nombre} (${usuario.codigo})`);
        }

        console.log('\n✅ ¡Usuarios actualizados correctamente!');
        await db.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

updateUsers();