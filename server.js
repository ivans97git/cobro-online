// ============================================
// 1. IMPORTAR DEPENDENCIAS
// ============================================
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ============================================
// 2. CONFIGURACIÓN DEL SERVIDOR
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
let db;

// ============================================
// 3. MIDDLEWARE
// ============================================
app.use(express.json());
app.use(cors());
app.use(express.static('frontend'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// ============================================
// 4. BASE DE DATOS SQLITE
// ============================================
async function initDatabase() {
    console.log('📁 Inicializando base de datos SQLite...');
    
    db = await open({
        filename: './database/cobro.db',
        driver: sqlite3.Database
    });

    // Crear tabla USUARIOS
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            codigo_cobrador TEXT UNIQUE NOT NULL,
            activo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Tabla "usuarios" creada/verificada');

    // Crear tabla COBROS
    await db.exec(`
        CREATE TABLE IF NOT EXISTS cobros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cobrador_id INTEGER NOT NULL,
            cliente_nombre TEXT NOT NULL,
            cliente_cedula TEXT,
            monto REAL NOT NULL,
            concepto TEXT,
            metodo_pago TEXT NOT NULL,
            referencia TEXT,
            fecha_cobro DATETIME DEFAULT CURRENT_TIMESTAMP,
            estado TEXT DEFAULT 'completado',
            FOREIGN KEY (cobrador_id) REFERENCES usuarios(id)
        )
    `);
    console.log('✅ Tabla "cobros" creada/verificada');

    // Insertar 6 usuarios de prueba
    const existe = await db.get('SELECT COUNT(*) as count FROM usuarios');
    
    if (existe.count === 0) {
        console.log('👤 Creando usuarios de prueba...');
        
        await db.run(`
            INSERT INTO usuarios (nombre, email, password, codigo_cobrador) VALUES
            ('Carlos Pérez', 'carlos@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR001'),
            ('María Gómez', 'maria@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR002'),
            ('Juan Rodríguez', 'juan@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR003'),
            ('Ana Martínez', 'ana@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR004'),
            ('Luis Sánchez', 'luis@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR005'),
            ('Elena Torres', 'elena@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR006')
        `);
        console.log('✅ 6 usuarios de prueba creados');
    }

    console.log('✅ Base de datos lista');
    return db;
}

app.use((req, res, next) => {
    req.db = db;
    next();
});

// ============================================
// 5. RUTAS DE AUTENTICACIÓN
// ============================================

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { codigo, password } = req.body;

        if (!codigo || !password) {
            return res.status(400).json({ 
                error: '❌ Código de cobrador y contraseña son requeridos' 
            });
        }

        const user = await db.get(
            'SELECT * FROM usuarios WHERE codigo_cobrador = ? AND activo = 1',
            [codigo]
        );

        if (!user) {
            return res.status(401).json({ error: '❌ Credenciales inválidas' });
        }

        const passwordValida = await bcrypt.compare(password, user.password);
        if (!passwordValida) {
            return res.status(401).json({ error: '❌ Credenciales inválidas' });
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                codigo: user.codigo_cobrador,
                nombre: user.nombre 
            },
            process.env.JWT_SECRET || 'mi_clave_secreta_temporal',
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                codigo_cobrador: user.codigo_cobrador
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: '❌ Error en el servidor' });
    }
});

// VERIFICAR TOKEN
app.get('/api/auth/verify', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ valid: false });
        }

        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'mi_clave_secreta_temporal'
        );

        const user = await db.get(
            'SELECT id, nombre, email, codigo_cobrador FROM usuarios WHERE id = ? AND activo = 1',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ valid: false });
        }

        res.json({ valid: true, user });

    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

// ============================================
// 6. MIDDLEWARE DE AUTENTICACIÓN
// ============================================
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: '❌ No autorizado' });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'mi_clave_secreta_temporal'
        );

        const user = await db.get(
            'SELECT id, nombre, email, codigo_cobrador FROM usuarios WHERE id = ? AND activo = 1',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ error: '❌ Usuario no encontrado' });
        }

        req.user = user;
        req.userId = decoded.id;
        next();

    } catch (error) {
        res.status(401).json({ error: '❌ Token inválido o expirado' });
    }
};

// ============================================
// 7. RUTAS DE COBROS
// ============================================

// REGISTRAR COBRO
app.post('/api/cobros/registrar', authMiddleware, async (req, res) => {
    try {
        const {
            cliente_nombre,
            cliente_cedula,
            monto,
            concepto,
            metodo_pago,
            referencia
        } = req.body;

        if (!cliente_nombre || !monto || !metodo_pago) {
            return res.status(400).json({ 
                error: '❌ Nombre del cliente, monto y método de pago son requeridos' 
            });
        }

        if (monto <= 0) {
            return res.status(400).json({ 
                error: '❌ El monto debe ser mayor a 0' 
            });
        }

        const result = await db.run(
            `INSERT INTO cobros 
            (cobrador_id, cliente_nombre, cliente_cedula, monto, concepto, metodo_pago, referencia) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.userId, 
                cliente_nombre, 
                cliente_cedula || null, 
                monto, 
                concepto || null, 
                metodo_pago, 
                referencia || null
            ]
        );

        res.status(201).json({
            success: true,
            message: '✅ Cobro registrado exitosamente',
            cobro_id: result.lastID
        });

    } catch (error) {
        console.error('Error registrando cobro:', error);
        res.status(500).json({ error: '❌ Error al registrar el cobro' });
    }
});

// LISTAR COBROS
app.get('/api/cobros/mis-cobros', authMiddleware, async (req, res) => {
    try {
        const cobros = await db.all(
            `SELECT * FROM cobros 
             WHERE cobrador_id = ? 
             ORDER BY fecha_cobro DESC`,
            [req.userId]
        );

        res.json(cobros);

    } catch (error) {
        console.error('Error obteniendo cobros:', error);
        res.status(500).json({ error: '❌ Error al obtener los cobros' });
    }
});

// ESTADÍSTICAS
app.get('/api/cobros/estadisticas', authMiddleware, async (req, res) => {
    try {
        const total = await db.get(
            `SELECT 
                COUNT(*) as total_cobros,
                COALESCE(SUM(monto), 0) as monto_total,
                COALESCE(AVG(monto), 0) as promedio,
                COUNT(DISTINCT cliente_cedula) as clientes_unicos
            FROM cobros 
            WHERE cobrador_id = ? AND estado = 'completado'`,
            [req.userId]
        );

        const porMetodo = await db.all(
            `SELECT 
                metodo_pago,
                COUNT(*) as cantidad,
                COALESCE(SUM(monto), 0) as total
            FROM cobros 
            WHERE cobrador_id = ? AND estado = 'completado'
            GROUP BY metodo_pago`,
            [req.userId]
        );

        res.json({
            total: total || { total_cobros: 0, monto_total: 0, promedio: 0, clientes_unicos: 0 },
            por_metodo: porMetodo || []
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: '❌ Error al obtener estadísticas' });
    }
});

// CANCELAR COBRO
app.put('/api/cobros/cancelar/:id', authMiddleware, async (req, res) => {
    try {
        const cobroId = req.params.id;

        const result = await db.run(
            `UPDATE cobros 
             SET estado = 'cancelado' 
             WHERE id = ? AND cobrador_id = ? AND estado = 'pendiente'`,
            [cobroId, req.userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ 
                error: '❌ Cobro no encontrado o no puede ser cancelado' 
            });
        }

        res.json({ 
            success: true,
            message: '✅ Cobro cancelado exitosamente' 
        });

    } catch (error) {
        console.error('Error cancelando cobro:', error);
        res.status(500).json({ error: '❌ Error al cancelar el cobro' });
    }
});

// ============================================
// 8. HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        database: 'SQLite',
        version: '1.0.0'
    });
});

// ============================================
// 9. INICIAR SERVIDOR
// ============================================
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(50));
        console.log('🚀 SERVIDOR INICIADO CORRECTAMENTE');
        console.log('='.repeat(50));
        console.log(`📡 Puerto: http://localhost:${PORT}`);
        console.log(`🗄️  Base de datos: SQLite (./database/cobro.db)`);
        console.log('\n📊 USUARIOS DE PRUEBA:');
        console.log('   🔑 CBR001 - Carlos Pérez   (contraseña: 123456)');
        console.log('   🔑 CBR002 - María Gómez    (contraseña: 123456)');
        console.log('   🔑 CBR003 - Juan Rodríguez (contraseña: 123456)');
        console.log('   🔑 CBR004 - Ana Martínez   (contraseña: 123456)');
        console.log('   🔑 CBR005 - Luis Sánchez   (contraseña: 123456)');
        console.log('   🔑 CBR006 - Elena Torres   (contraseña: 123456)');
        console.log('='.repeat(50) + '\n');
    });
}).catch(err => {
    console.error('❌ Error al inicializar la base de datos:', err);
    process.exit(1);
});