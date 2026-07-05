// ============================================
// CONFIGURACIÓN
// ============================================
const API_URL = window.location.origin;
let token = localStorage.getItem('token');
let currentUser = null;

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================
async function checkAuth() {
    if (!token) {
        showLogin();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showDashboard();
            await loadDashboardData();
        } else {
            localStorage.removeItem('token');
            token = null;
            showLogin();
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        showLogin();
    }
}

// ============================================
// MOSTRAR/OCULTAR SECCIONES
// ============================================
function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('userName').textContent = `👤 ${currentUser.nombre}`;
    document.getElementById('userCode').textContent = currentUser.codigo_cobrador;
}

// ============================================
// CARGAR DATOS DEL DASHBOARD
// ============================================
async function loadDashboardData() {
    await Promise.all([
        loadStats(),
        loadCobros()
    ]);
}

// ============================================
// CARGAR ESTADÍSTICAS
// ============================================
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/api/cobros/estadisticas`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            document.getElementById('totalCobros').textContent = data.total.total_cobros || 0;
            document.getElementById('montoTotal').textContent = `$${parseFloat(data.total.monto_total || 0).toFixed(2)}`;
            document.getElementById('promedio').textContent = `$${parseFloat(data.total.promedio || 0).toFixed(2)}`;
            document.getElementById('clientesUnicos').textContent = data.total.clientes_unicos || 0;

            const detalleDiv = document.getElementById('metodosDetalle');
            detalleDiv.innerHTML = '';
            
            if (data.por_metodo && data.por_metodo.length > 0) {
                data.por_metodo.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'stat-item';
                    div.innerHTML = `
                        <span>${item.metodo_pago}:</span>
                        <span>${item.cantidad} - $${parseFloat(item.total).toFixed(2)}</span>
                    `;
                    detalleDiv.appendChild(div);
                });
            } else {
                detalleDiv.innerHTML = '<p style="color:#9ca3af; font-size:14px;">No hay datos</p>';
            }
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// ============================================
// CARGAR HISTORIAL DE COBROS
// ============================================
async function loadCobros() {
    try {
        const response = await fetch(`${API_URL}/api/cobros/mis-cobros`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const cobros = await response.json();
            const tbody = document.getElementById('cobrosTableBody');
            
            if (cobros.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#9ca3af;">No hay cobros registrados</td></tr>';
                return;
            }

            const estadoColors = {
                'completado': '#10b981',
                'pendiente': '#f59e0b',
                'cancelado': '#ef4444'
            };

            tbody.innerHTML = cobros.map(cobro => `
                <tr>
                    <td>${new Date(cobro.fecha_cobro).toLocaleString('es-ES')}</td>
                    <td><strong>${cobro.cliente_nombre}</strong></td>
                    <td>$${parseFloat(cobro.monto).toFixed(2)}</td>
                    <td>${cobro.metodo_pago}</td>
                    <td>${cobro.concepto || '-'}</td>
                    <td>
                        <span style="
                            background: ${estadoColors[cobro.estado] || '#6b7280'};
                            color: white;
                            padding: 3px 12px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 600;
                        ">${cobro.estado}</span>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando cobros:', error);
    }
}

// ============================================
// EVENTO: LOGIN
// ============================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const codigo = document.getElementById('codigo').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.textContent = '';
    errorDiv.className = 'error-message';

    if (!codigo || !password) {
        errorDiv.textContent = '❌ Por favor complete todos los campos';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo, password })
        });

        const data = await response.json();

        if (!response.ok) {
            errorDiv.textContent = data.error || '❌ Error al iniciar sesión';
            return;
        }

        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        
        showDashboard();
        await loadDashboardData();
        document.getElementById('loginForm').reset();

    } catch (error) {
        errorDiv.textContent = '❌ Error de conexión con el servidor';
        console.error('Error en login:', error);
    }
});

// ============================================
// EVENTO: REGISTRAR COBRO
// ============================================
document.getElementById('cobroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cobroData = {
        cliente_nombre: document.getElementById('clienteNombre').value.trim(),
        cliente_cedula: document.getElementById('clienteCedula').value.trim(),
        monto: parseFloat(document.getElementById('monto').value),
        concepto: document.getElementById('concepto').value.trim(),
        metodo_pago: document.getElementById('metodoPago').value,
        referencia: document.getElementById('referencia').value.trim()
    };

    const messageDiv = document.getElementById('cobroMessage');
    messageDiv.textContent = '';
    messageDiv.className = 'message';

    if (!cobroData.cliente_nombre) {
        messageDiv.textContent = '❌ El nombre del cliente es requerido';
        messageDiv.className = 'message error';
        return;
    }

    if (isNaN(cobroData.monto) || cobroData.monto <= 0) {
        messageDiv.textContent = '❌ Ingrese un monto válido mayor a 0';
        messageDiv.className = 'message error';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/cobros/registrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(cobroData)
        });

        const data = await response.json();

        if (!response.ok) {
            messageDiv.textContent = data.error || '❌ Error al registrar cobro';
            messageDiv.className = 'message error';
            return;
        }

        messageDiv.textContent = '✅ Cobro registrado exitosamente';
        messageDiv.className = 'message success';
        
        document.getElementById('clienteNombre').value = '';
        document.getElementById('clienteCedula').value = '';
        document.getElementById('monto').value = '';
        document.getElementById('concepto').value = '';
        document.getElementById('referencia').value = '';
        
        await loadDashboardData();

        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 3000);

    } catch (error) {
        messageDiv.textContent = '❌ Error de conexión con el servidor';
        messageDiv.className = 'message error';
        console.error('Error registrando cobro:', error);
    }
});

// ============================================
// EVENTO: CERRAR SESIÓN
// ============================================
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showLogin();
});

// ============================================
// EVENTOS: ACTUALIZAR DATOS
// ============================================
document.getElementById('refreshStats').addEventListener('click', loadStats);
document.getElementById('refreshCobros').addEventListener('click', loadCobros);

// ============================================
// INICIAR APLICACIÓN
// ============================================
checkAuth();
