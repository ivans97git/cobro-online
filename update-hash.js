const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function updateHashes() {
    try {
        const db = await open({
            filename: './database/cobro.db',
            driver: sqlite3.Database
        });

        const hashCorrecto = await bcrypt.hash('123456', 10);
        
        await db.run(`
            UPDATE usuarios 
            SET password = ? 
            WHERE codigo_cobrador IN ('CBR001', 'CBR002', 'CBR003', 'CBR004', 'CBR005', 'CBR006')
        `, [hashCorrecto]);

        console.log('✅ Hashes actualizados para todos los usuarios');
        await db.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

updateHashes();
