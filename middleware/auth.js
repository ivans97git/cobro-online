const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar que el usuario existe y está activo
        const [rows] = await req.db.execute(
            'SELECT id, nombre, email, codigo_cobrador FROM usuarios WHERE id = ? AND activo = TRUE',
            [decoded.id]
        );

        if (rows.length === 0) {
            throw new Error('Usuario no encontrado o inactivo');
        }

        req.user = rows[0];
        req.userId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
    }
};

module.exports = authMiddleware;