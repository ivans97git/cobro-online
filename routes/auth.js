const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { codigo, password } = req.body;

        if (!codigo || !password) {
            return res.status(400).json({ 
                error: 'Código de cobrador y contraseña son requeridos' 
            });
        }

        // Buscar usuario por código
        const [rows] = await req.db.execute(
            'SELECT * FROM usuarios WHERE codigo_cobrador = ? AND activo = TRUE',
            [codigo]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = rows[0];

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar token
        const token = jwt.sign(
            { id: user.id, codigo: user.codigo_cobrador },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
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
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Verificar token
router.get('/verify', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ valid: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const rows = await req.db.all(
            'SELECT id, nombre, email, codigo_cobrador FROM usuarios WHERE id = ? AND activo = TRUE',
            [decoded.id]
        );

        if (rows.length === 0) {
            return res.status(401).json({ valid: false });
        }

        res.json({ valid: true, user: rows[0] });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

module.exports = router;