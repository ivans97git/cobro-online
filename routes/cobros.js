const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Todas las rutas de cobros requieren autenticación
router.use(authMiddleware);

// Registrar un nuevo cobro
router.post('/registrar', async (req, res) => {
    try {
        const {
            cliente_nombre,
            cliente_cedula,
            monto,
            concepto,
            metodo_pago,
            referencia
        } = req.body;

        // Validaciones
        if (!cliente_nombre || !monto || !metodo_pago) {
            return res.status(400).json({ 
                error: 'Nombre del cliente, monto y método de pago son requeridos' 
            });
        }

        if (monto <= 0) {
            return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
        }

        const [result] = await req.db.execute(
            `INSERT INTO cobros 
            (cobrador_id, cliente_nombre, cliente_cedula, monto, concepto, metodo_pago, referencia) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, cliente_nombre, cliente_cedula, monto, concepto, metodo_pago, referencia]
        );

        res.status(201).json({
            message: 'Cobro registrado exitosamente',
            cobro_id: result.insertId
        });

    } catch (error) {
        console.error('Error registrando cobro:', error);
        res.status(500).json({ error: 'Error al registrar el cobro' });
    }
});

// Obtener cobros del cobrador autenticado
router.get('/mis-cobros', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, estado } = req.query;
        
        let query = `SELECT * FROM cobros WHERE cobrador_id = ?`;
        const params = [req.userId];

        if (fecha_inicio) {
            query += ` AND fecha_cobro >= ?`;
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            query += ` AND fecha_cobro <= ?`;
            params.push(fecha_fin);
        }
        if (estado) {
            query += ` AND estado = ?`;
            params.push(estado);
        }

        query += ` ORDER BY fecha_cobro DESC`;

        const [rows] = await req.db.execute(query, params);
        res.json(rows);

    } catch (error) {
        console.error('Error obteniendo cobros:', error);
        res.status(500).json({ error: 'Error al obtener los cobros' });
    }
});

// Obtener estadísticas del cobrador
router.get('/estadisticas', async (req, res) => {
    try {
        const [total] = await req.db.execute(
            `SELECT 
                COUNT(*) as total_cobros,
                SUM(monto) as monto_total,
                AVG(monto) as promedio,
                COUNT(DISTINCT cliente_cedula) as clientes_unicos
            FROM cobros 
            WHERE cobrador_id = ? AND estado = 'completado'`,
            [req.userId]
        );

        const [porMetodo] = await req.db.execute(
            `SELECT 
                metodo_pago,
                COUNT(*) as cantidad,
                SUM(monto) as total
            FROM cobros 
            WHERE cobrador_id = ? AND estado = 'completado'
            GROUP BY metodo_pago`,
            [req.userId]
        );

        res.json({
            total: total[0],
            por_metodo: porMetodo
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Cancelar un cobro
router.put('/cancelar/:id', async (req, res) => {
    try {
        const cobroId = req.params.id;

        const [result] = await req.db.execute(
            `UPDATE cobros 
            SET estado = 'cancelado' 
            WHERE id = ? AND cobrador_id = ? AND estado = 'pendiente'`,
            [cobroId, req.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                error: 'Cobro no encontrado o no puede ser cancelado' 
            });
        }

        res.json({ message: 'Cobro cancelado exitosamente' });

    } catch (error) {
        console.error('Error cancelando cobro:', error);
        res.status(500).json({ error: 'Error al cancelar el cobro' });
    }
});

module.exports = router;