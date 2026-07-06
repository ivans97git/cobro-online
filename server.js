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
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    }
});
app.use('/api/', limiter);

// ============================================
// 4. BASE DE DATOS SQLITE
// ============================================
async function initDatabase() {
    console.log('📁 Inicializando base de datos SQLite...');
    
    db = await open({
        filename: './database/internet.db',
        driver: sqlite3.Database
    });

    // --- USUARIOS ---
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

    // --- PLANES DE INTERNET ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS planes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            velocidad TEXT NOT NULL,
            precio REAL NOT NULL,
            descripcion TEXT,
            activo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Tabla "planes" creada/verificada');

    // --- CLIENTES (CON DNI/CÉDULA) ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            cedula TEXT UNIQUE,
            telefono TEXT NOT NULL,
            direccion TEXT,
            email TEXT,
            plan_id INTEGER NOT NULL,
            fecha_instalacion DATE,
            fecha_corte DATE,
            activo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (plan_id) REFERENCES planes(id)
        )
    `);
    console.log('✅ Tabla "clientes" creada/verificada');

    // --- PAGOS ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            cobrador_id INTEGER NOT NULL,
            monto REAL NOT NULL,
            mes INTEGER NOT NULL,
            anio INTEGER NOT NULL,
            fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
            metodo_pago TEXT NOT NULL,
            referencia TEXT,
            estado TEXT DEFAULT 'completado',
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (cobrador_id) REFERENCES usuarios(id)
        )
    `);
    console.log('✅ Tabla "pagos" creada/verificada');

    // --- DEUDAS ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS deudas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            mes INTEGER NOT NULL,
            anio INTEGER NOT NULL,
            monto REAL NOT NULL,
            estado TEXT DEFAULT 'pendiente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);
    console.log('✅ Tabla "deudas" creada/verificada');

    // ============================================
    // DATOS INICIALES
    // ============================================
    
    // 1. PLANES POR DEFECTO
    const planesExisten = await db.get('SELECT COUNT(*) as count FROM planes');
    if (planesExisten.count === 0) {
        console.log('📡 Creando planes de internet...');
        await db.run(`
            INSERT INTO planes (nombre, velocidad, precio, descripcion) VALUES
            ('Básico', '10 Mbps', 15000, 'Plan básico para navegación'),
            ('Estándar', '20 Mbps', 25000, 'Plan estándar para streaming'),
            ('Premium', '50 Mbps', 35000, 'Plan premium para gaming y 4K'),
            ('Empresarial', '100 Mbps', 50000, 'Plan empresarial con prioridad')
        `);
        console.log('✅ Planes creados');
    }

    // 2. USUARIOS COBRADORES
    const usuariosExisten = await db.get('SELECT COUNT(*) as count FROM usuarios');
    if (usuariosExisten.count === 0) {
        console.log('👤 Creando cobradores...');
        const cobradores = [
            { nombre: 'Pablo Vazquez', codigo: 'Pablo', password: 'pablo2503' },
            { nombre: 'Patricia Britez', codigo: 'Pato', password: 'pato2026' },
            { nombre: 'Andres Segovia', codigo: 'ivan', password: 'ivan26' },
            { nombre: 'Alcides Saavedra', codigo: 'Alcides', password: 'alcides26' },
            { nombre: 'Esteban Britez', codigo: 'capeli', password: 'capeli26' }
        ];

        for (const c of cobradores) {
            const hash = await bcrypt.hash(c.password, 10);
            await db.run(`
                INSERT INTO usuarios (nombre, email, password, codigo_cobrador) 
                VALUES (?, ?, ?, ?)
            `, [
                c.nombre,
                `${c.codigo.toLowerCase()}@cobro.com`,
                hash,
                c.codigo
            ]);
        }
        console.log('✅ Cobradores creados');
    }

    // 3. CLIENTES DE EJEMPLO
    const clientesExisten = await db.get('SELECT COUNT(*) as count FROM clientes');
    if (clientesExisten.count === 0) {
        console.log('👥 Creando clientes de ejemplo...');
        await db.run(`
            INSERT INTO clientes (nombre, cedula, telefono, direccion, email, plan_id, fecha_instalacion) VALUES
            ('Juan Pérez', '12345678', '+595981123456', 'Av. España 123', 'juan@email.com', 1, '2024-01-15'),
            ('María González', '87654321', '+595981234567', 'Calle Palma 456', 'maria@email.com', 2, '2024-02-01'),
            ('Carlos López', '11223344', '+595981345678', 'San Lorenzo 789', 'carlos@email.com', 3, '2024-03-10')
        `);
        console.log('✅ Clientes de ejemplo creados');
    }

    console.log('✅ Base de datos lista');
    return db;
}

// ============================================
// 5. FUNCIÓN PARA ENVIAR WHATSAPP
// ============================================
function generarMensajeWhatsApp(cliente, deuda) {
    const mensaje = `📢 *RECORDATORIO DE PAGO - INTERNET*

Hola *${cliente.nombre}*, 

📌 Te recordamos que tienes un pago pendiente de *${deuda.monto.toLocaleString()} Gs* correspondiente al mes *${deuda.mes}/${deuda.anio}*.

⏰ Fecha límite de pago: *${new Date().toLocaleDateString()}*

📲 Si ya realizaste el pago, ignora este mensaje.

¡Gracias por confiar en nosotros!`;
    return mensaje;
}

async function enviarWhatsApp(telefono, mensaje) {
    try {
        // Configuración de Twilio (reemplazar con tus credenciales)
        const accountSid = process.env.TWILIO_ACCOUNT_SID || 'tu_account_sid';
        const authToken = process.env.TWILIO_AUTH_TOKEN || 'tu_auth_token';
        const twilioPhone = process.env.TWILIO_PHONE || '+1234567890';
        
        if (!process.env.TWILIO_ACCOUNT_SID) {
            console.log(`📱 [SIMULACIÓN] Mensaje enviado a ${telefono}:`, mensaje);
            return { success: true, simulado: true };
        }
        
        const client = require('twilio')(accountSid, authToken);
        await client.messages.create({
            body: mensaje,
            from: twilioPhone,
            to: telefono
        });
        
        console.log(`✅ WhatsApp enviado a ${telefono}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error enviando WhatsApp:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// 6. RUTAS DE AUTENTICACIÓN
// ============================================
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
            { id: user.id, codigo: user.codigo_cobrador, nombre: user.nombre },
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mi_clave_secreta_temporal');
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
// 7. MIDDLEWARE DE AUTENTICACIÓN
// ============================================
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: '❌ No autorizado' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mi_clave_secreta_temporal');
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
// 8. RUTAS DE CLIENTES
// ============================================

// LISTAR CLIENTES
app.get('/api/clientes', authMiddleware, async (req, res) => {
    try {
        const clientes = await db.all(`
            SELECT c.*, p.nombre as plan_nombre, p.velocidad, p.precio as plan_precio
            FROM clientes c
            LEFT JOIN planes p ON c.plan_id = p.id
            WHERE c.activo = 1
            ORDER BY c.nombre
        `);
        res.json(clientes);
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// BUSCAR CLIENTES POR NOMBRE O CÉDULA (CON HISTORIAL DE PAGOS)
app.get('/api/clientes/buscar', authMiddleware, async (req, res) => {
    try {
        const { termino } = req.query;
        
        if (!termino || termino.trim() === '') {
            return res.status(400).json({ 
                error: '❌ Ingrese un término de búsqueda' 
            });
        }

        const searchTerm = `%${termino.trim()}%`;
        
        // Buscar clientes
        const clientes = await db.all(`
            SELECT 
                c.*, 
                p.nombre as plan_nombre, 
                p.velocidad, 
                p.precio as plan_precio
            FROM clientes c
            LEFT JOIN planes p ON c.plan_id = p.id
            WHERE c.activo = 1
            AND (
                c.nombre LIKE ? 
                OR c.cedula LIKE ? 
                OR c.telefono LIKE ? 
                OR c.direccion LIKE ? 
                OR c.email LIKE ?
            )
            ORDER BY c.nombre
        `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

        // Para cada cliente, obtener su historial de pagos
        for (const cliente of clientes) {
            const pagos = await db.all(`
                SELECT 
                    p.*,
                    u.nombre as cobrador_nombre
                FROM pagos p
                LEFT JOIN usuarios u ON p.cobrador_id = u.id
                WHERE p.cliente_id = ?
                ORDER BY p.anio DESC, p.mes DESC
            `, [cliente.id]);
            
            cliente.historial_pagos = pagos;
            
            // Calcular deuda actual
            const mesActual = new Date().getMonth() + 1;
            const anioActual = new Date().getFullYear();
            
            const pagosRecientes = pagos.filter(p => p.anio === anioActual && p.mes === mesActual);
            cliente.pago_mes_actual = pagosRecientes.length > 0;
            
            // Contar meses de deuda
            const mesesPagados = pagos.map(p => `${p.anio}-${p.mes}`);
            let mesesDeuda = [];
            
            for (let i = 0; i < 6; i++) {
                let mes = mesActual - i;
                let anio = anioActual;
                if (mes <= 0) {
                    mes += 12;
                    anio -= 1;
                }
                const key = `${anio}-${mes}`;
                if (!mesesPagados.includes(key)) {
                    mesesDeuda.push({ mes, anio });
                }
            }
            
            cliente.meses_deuda = mesesDeuda;
            cliente.total_deuda = mesesDeuda.length * (cliente.plan_precio || 0);
        }

        res.json({
            success: true,
            count: clientes.length,
            clientes: clientes
        });

    } catch (error) {
        console.error('Error buscando clientes:', error);
        res.status(500).json({ error: '❌ Error al buscar clientes' });
    }
});

// OBTENER DETALLE COMPLETO DE UN CLIENTE (CON HISTORIAL)
app.get('/api/clientes/:id', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.params.id;
        
        const cliente = await db.get(`
            SELECT c.*, p.nombre as plan_nombre, p.velocidad, p.precio as plan_precio
            FROM clientes c
            LEFT JOIN planes p ON c.plan_id = p.id
            WHERE c.id = ?
        `, [clienteId]);

        if (!cliente) {
            return res.status(404).json({ error: '❌ Cliente no encontrado' });
        }

        // Obtener historial de pagos
        const pagos = await db.all(`
            SELECT 
                p.*,
                u.nombre as cobrador_nombre
            FROM pagos p
            LEFT JOIN usuarios u ON p.cobrador_id = u.id
            WHERE p.cliente_id = ?
            ORDER BY p.anio DESC, p.mes DESC
        `, [clienteId]);
        
        cliente.historial_pagos = pagos;
        
        // Resumen de pagos
        const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
        cliente.total_pagado = totalPagado;
        cliente.total_pagos = pagos.length;

        res.json(cliente);
    } catch (error) {
        console.error('Error obteniendo cliente:', error);
        res.status(500).json({ error: '❌ Error al obtener cliente' });
    }
});

// CREAR CLIENTE
app.post('/api/clientes', authMiddleware, async (req, res) => {
    try {
        const { 
            nombre, 
            cedula, 
            telefono, 
            direccion, 
            email, 
            plan_id, 
            fecha_instalacion 
        } = req.body;

        if (!nombre || !telefono || !plan_id) {
            return res.status(400).json({ 
                error: 'Nombre, teléfono y plan son requeridos' 
            });
        }

        if (cedula) {
            const existente = await db.get(
                'SELECT id FROM clientes WHERE cedula = ?', 
                [cedula]
            );
            if (existente) {
                return res.status(400).json({ 
                    error: '❌ Ya existe un cliente con esta cédula' 
                });
            }
        }

        const result = await db.run(`
            INSERT INTO clientes 
            (nombre, cedula, telefono, direccion, email, plan_id, fecha_instalacion)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [nombre, cedula || null, telefono, direccion || null, email || null, plan_id, fecha_instalacion || null]);

        res.status(201).json({
            success: true,
            message: '✅ Cliente creado exitosamente',
            cliente_id: result.lastID
        });
    } catch (error) {
        console.error('Error creando cliente:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

// ============================================
// 9. RUTAS DE PLANES
// ============================================
app.get('/api/planes', authMiddleware, async (req, res) => {
    try {
        const planes = await db.all('SELECT * FROM planes WHERE activo = 1 ORDER BY precio');
        res.json(planes);
    } catch (error) {
        console.error('Error obteniendo planes:', error);
        res.status(500).json({ error: 'Error al obtener planes' });
    }
});

// ============================================
// 10. RUTAS DE PAGOS
// ============================================

// REGISTRAR PAGO
app.post('/api/pagos', authMiddleware, async (req, res) => {
    try {
        const { cliente_id, monto, mes, anio, metodo_pago, referencia } = req.body;

        if (!cliente_id || !monto || !mes || !anio || !metodo_pago) {
            return res.status(400).json({ 
                error: 'Cliente, monto, mes, año y método de pago son requeridos' 
            });
        }

        const pagoExistente = await db.get(`
            SELECT id FROM pagos 
            WHERE cliente_id = ? AND mes = ? AND anio = ?
        `, [cliente_id, mes, anio]);

        if (pagoExistente) {
            return res.status(400).json({ 
                error: 'Ya existe un pago registrado para este mes y año' 
            });
        }

        const result = await db.run(`
            INSERT INTO pagos (cliente_id, cobrador_id, monto, mes, anio, metodo_pago, referencia)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [cliente_id, req.userId, monto, mes, anio, metodo_pago, referencia || null]);

        await db.run(`
            DELETE FROM deudas WHERE cliente_id = ? AND mes = ? AND anio = ?
        `, [cliente_id, mes, anio]);

        res.status(201).json({
            success: true,
            message: '✅ Pago registrado exitosamente',
            pago_id: result.lastID
        });
    } catch (error) {
        console.error('Error registrando pago:', error);
        res.status(500).json({ error: 'Error al registrar pago' });
    }
});

// ============================================
// 11. RUTAS DE MOROSIDAD
// ============================================
app.get('/api/morosos', authMiddleware, async (req, res) => {
    try {
        const mesActual = new Date().getMonth() + 1;
        const anioActual = new Date().getFullYear();

        const morosos = await db.all(`
            SELECT 
                c.id,
                c.nombre,
                c.cedula,
                c.telefono,
                c.direccion,
                p.nombre as plan_nombre,
                p.precio as monto_deuda
            FROM clientes c
            LEFT JOIN planes p ON c.plan_id = p.id
            WHERE c.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM pagos pg 
                WHERE pg.cliente_id = c.id 
                AND pg.mes = ? 
                AND pg.anio = ?
            )
        `, [mesActual, anioActual]);

        for (const cliente of morosos) {
            const pagos = await db.all(`
                SELECT mes, anio FROM pagos 
                WHERE cliente_id = ? 
                ORDER BY anio DESC, mes DESC
            `, [cliente.id]);

            const mesesPagados = pagos.map(p => `${p.anio}-${p.mes}`);
            const mesesDeuda = [];
            
            for (let i = 0; i < 6; i++) {
                let mes = mesActual - i;
                let anio = anioActual;
                if (mes <= 0) {
                    mes += 12;
                    anio -= 1;
                }
                const key = `${anio}-${mes}`;
                if (!mesesPagados.includes(key)) {
                    mesesDeuda.push({ mes, anio });
                }
            }
            
            cliente.meses_deuda = mesesDeuda;
            cliente.total_deuda = mesesDeuda.length * (cliente.monto_deuda || 0);
        }

        res.json(morosos);
    } catch (error) {
        console.error('Error obteniendo morosos:', error);
        res.status(500).json({ error: 'Error al obtener morosos' });
    }
});

// ============================================
// 12. RUTAS DE WHATSAPP
// ============================================
app.post('/api/enviar-whatsapp/:cliente_id', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.params.cliente_id;
        const { mes, anio } = req.body;

        const cliente = await db.get(`
            SELECT c.*, p.nombre as plan_nombre, p.precio
            FROM clientes c
            LEFT JOIN planes p ON c.plan_id = p.id
            WHERE c.id = ?
        `, [clienteId]);

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        await db.run(`
            INSERT INTO deudas (cliente_id, mes, anio, monto)
            VALUES (?, ?, ?, ?)
        `, [clienteId, mes, anio, cliente.precio]);

        const mensaje = generarMensajeWhatsApp(cliente, {
            mes: mes,
            anio: anio,
            monto: cliente.precio
        });

        const resultado = await enviarWhatsApp(cliente.telefono, mensaje);

        res.json({
            success: true,
            message: '✅ Recordatorio enviado',
            cliente: cliente.nombre,
            telefono: cliente.telefono,
            resultado: resultado
        });
    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        res.status(500).json({ error: 'Error al enviar WhatsApp' });
    }
});

app.post('/api/enviar-recordatorios-masivos', authMiddleware, async (req, res) => {
    try {
        const mesActual = new Date().getMonth() + 1;
        const anioActual = new Date().getFullYear();

        const morosos = await db.all(`
            SELECT c.id, c.nombre, c.telefono, p.precio
            FROM clientes c
            LEFT JOIN planes p ON c.plan_id = p.id
            WHERE c.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM pagos pg 
                WHERE pg.cliente_id = c.id 
                AND pg.mes = ? 
                AND pg.anio = ?
            )
        `, [mesActual, anioActual]);

        let enviados = 0;
        let errores = 0;

        for (const cliente of morosos) {
            try {
                await db.run(`
                    INSERT INTO deudas (cliente_id, mes, anio, monto)
                    VALUES (?, ?, ?, ?)
                `, [cliente.id, mesActual, anioActual, cliente.precio]);

                const mensaje = generarMensajeWhatsApp(cliente, {
                    mes: mesActual,
                    anio: anioActual,
                    monto: cliente.precio
                });

                await enviarWhatsApp(cliente.telefono, mensaje);
                enviados++;
            } catch (error) {
                console.error(`Error con cliente ${cliente.id}:`, error);
                errores++;
            }
        }

        res.json({
            success: true,
            message: `✅ Recordatorios enviados: ${enviados} exitosos, ${errores} fallidos`,
            total: morosos.length,
            enviados: enviados,
            errores: errores
        });
    } catch (error) {
        console.error('Error enviando recordatorios masivos:', error);
        res.status(500).json({ error: 'Error al enviar recordatorios' });
    }
});

// ============================================
// 13. HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        database: 'SQLite',
        version: '2.0.0',
        system: 'Gestion de Internet'
    });
});

// ============================================
// 14. INICIAR SERVIDOR
// ============================================
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(50));
        console.log('🚀 SISTEMA DE GESTIÓN DE INTERNET');
        console.log('='.repeat(50));
        console.log(`📡 Puerto: http://localhost:${PORT}`);
        console.log(`🗄️  Base de datos: SQLite (./database/internet.db)`);
        console.log('\n📊 CREDENCIALES DE ACCESO:');
        console.log('   🔑 Pablo   - Contraseña: pablo2503');
        console.log('   🔑 Pato    - Contraseña: pato2026');
        console.log('   🔑 ivan    - Contraseña: ivan26');
        console.log('   🔑 Alcides - Contraseña: alcides26');
        console.log('   🔑 capeli  - Contraseña: capeli26');
        console.log('='.repeat(50) + '\n');
    });
}).catch(err => {
    console.error('❌ Error al inicializar la base de datos:', err);
    process.exit(1);
});
