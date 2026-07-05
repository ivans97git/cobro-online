CREATE DATABASE IF NOT EXISTS cobro_db;
USE cobro_db;

-- Tabla de usuarios cobradores
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    codigo_cobrador VARCHAR(10) UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cobros
CREATE TABLE cobros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cobrador_id INT NOT NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_cedula VARCHAR(20),
    monto DECIMAL(10,2) NOT NULL,
    concepto VARCHAR(255),
    metodo_pago ENUM('efectivo', 'transferencia', 'tarjeta', 'pago_movil') NOT NULL,
    referencia VARCHAR(100),
    fecha_cobro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('pendiente', 'completado', 'cancelado') DEFAULT 'completado',
    FOREIGN KEY (cobrador_id) REFERENCES usuarios(id)
);

-- Insertar 6 usuarios cobradores (contraseña: 123456)
INSERT INTO usuarios (nombre, email, password, codigo_cobrador) VALUES
('Carlos Pérez', 'carlos@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR001'),
('María Gómez', 'maria@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR002'),
('Juan Rodríguez', 'juan@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR003'),
('Ana Martínez', 'ana@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR004'),
('Luis Sánchez', 'luis@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR005'),
('Elena Torres', 'elena@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR006');

-- NOTA: Las contraseñas en producción deben generarse con bcrypt
-- Para generar contraseñas usa: bcrypt.hashSync('123456', 10)CREATE DATABASE IF NOT EXISTS cobro_db;
USE cobro_db;

-- Tabla de usuarios cobradores
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    codigo_cobrador VARCHAR(10) UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cobros
CREATE TABLE cobros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cobrador_id INT NOT NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_cedula VARCHAR(20),
    monto DECIMAL(10,2) NOT NULL,
    concepto VARCHAR(255),
    metodo_pago ENUM('efectivo', 'transferencia', 'tarjeta', 'pago_movil') NOT NULL,
    referencia VARCHAR(100),
    fecha_cobro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('pendiente', 'completado', 'cancelado') DEFAULT 'completado',
    FOREIGN KEY (cobrador_id) REFERENCES usuarios(id)
);

-- Insertar 6 usuarios cobradores (contraseña: 123456)
INSERT INTO usuarios (nombre, email, password, codigo_cobrador) VALUES
('Carlos Pérez', 'carlos@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR001'),
('María Gómez', 'maria@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR002'),
('Juan Rodríguez', 'juan@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR003'),
('Ana Martínez', 'ana@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR004'),
('Luis Sánchez', 'luis@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR005'),
('Elena Torres', 'elena@cobro.com', '$2a$10$9C5VqZqZqZqZqZqZqZqZqO', 'CBR006');

-- NOTA: Las contraseñas en producción deben generarse con bcrypt
-- Para generar contraseñas usa: bcrypt.hashSync('123456', 10)