// ============================================
// CONFIGURACIÓN
// ============================================
const API_URL = window.location.origin;
let token = localStorage.getItem('token');
let currentUser = null;
let currentTab = 'clientes';

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
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showDashboard();
            await Promise.all([
                loadClientes(),
                loadPlanes(),
                loadMorosos()
            ]);
            await cargarClientesEnSelect();
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
// NAVEGACIÓN POR TABS
// ============================================
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        // Cambiar tab activa
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Cambiar contenido
        const tabName = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        // Cargar datos según tab
        if (tabName === 'clientes') loadClientes();
        if (tabName === 'morosos') loadMorosos();
        if (tabName === 'planes') loadPlanes();
        if (tabName === 'pagos') cargarClientesEnSelect();
    });
});

// ============================================
// FUNCIONES DE CARGA
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
// CARGAR CLIENTES
// ============================================
async function loadClientes() {
    try {
        const response = await fetch(`${API_URL}/api/clientes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const clientes = await response.json();
            const tbody = document.getElementById('clientesTableBody');
            
            if (clientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes registrados</td></tr>';
                return;
            }

            tbody.innerHTML = clientes.map(c => `
                <tr>
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.telefono}</td>
                    <td>${c.plan_nombre || 'Sin plan'} (${c.velocidad || ''})</td>
                    <td>${c.fecha_instalacion || '-'}</td>
                    <td><span class="badge" style="background:${c.activo ? '#10b981' : '#ef4444'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

// ============================================
// CARGAR PLANES
// ============================================
async function loadPlanes() {
    try {
        const response = await fetch(`${API_URL}/api/planes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const planes = await response.json();
            const tbody = document.getElementById('planesTableBody');
            
            if (planes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay planes configurados</td></tr>';
                return;
            }

            tbody.innerHTML = planes.map(p => `
                <tr>
                    <td><strong>${p.nombre}</strong></td>
                    <td>${p.velocidad}</td>
                    <td>$${p.precio.toLocaleString()}</td>
                    <td>${p.descripcion || '-'}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando planes:', error);
    }
}

// ============================================
// CARGAR MOROSOS
// ============================================
async function loadMorosos() {
    try {
        const response = await fetch(`${API_URL}/api/morosos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const morosos = await response.json();
            const tbody = document.getElementById('morososTableBody');
            
            if (morosos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">🎉 No hay clientes morosos</td></tr>';
                return;
            }

            tbody.innerHTML = morosos.map(m => `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td>${m.telefono}</td>
                    <td>${m.plan_nombre || 'Sin plan'}</td>
                    <td>${m.meses_deuda?.length || 0} meses</td>
                    <td>$${m.total_deuda?.toLocaleString() || 0}</td>
                    <td>
                        <button class="btn-whatsapp" onclick="enviarWhatsApp(${m.id})">📱 WhatsApp</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando morosos:', error);
    }
}

// ============================================
// CARGAR CLIENTES EN SELECT
// ============================================
async function cargarClientesEnSelect() {
    try {
        const response = await fetch(`${API_URL}/api/clientes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const clientes = await response.json();
            const select = document.getElementById('clientePago');
            
            select.innerHTML = '<option value="">Seleccionar cliente...</option>';
            clientes.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.nombre} - ${c.plan_nombre || 'Sin plan'}</option>`;
            });
        }
    } catch (error) {
        console.error('Error cargando clientes en select:', error);
    }
}

// ============================================
// REGISTRAR PAGO
// ============================================
document.getElementById('pagoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cliente_id = document.getElementById('clientePago').value;
    const mes = document.getElementById('mesPago').value;
    const anio = document.getElementById('anioPago').value;
    const monto = document.getElementById('montoPago').value;
    const metodo_pago = document.getElementById('metodoPagoPago').value;

    const messageDiv = document.getElementById('pagoMessage');
    messageDiv.textContent = '';
    messageDiv.className = 'message';

    if (!cliente_id) {
        messageDiv.textContent = '❌ Seleccione un cliente';
        messageDiv.className = 'message error';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/pagos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                cliente_id: parseInt(cliente_id),
                mes: parseInt(mes),
                anio: parseInt(anio),
                monto: parseFloat(monto),
                metodo_pago
            })
        });

        const data = await response.json();

        if (!response.ok) {
            messageDiv.textContent = data.error || '❌ Error al registrar pago';
            messageDiv.className = 'message error';
            return;
        }

        messageDiv.textContent = '✅ Pago registrado exitosamente';
        messageDiv.className = 'message success';
        
        document.getElementById('pagoForm').reset();
        await loadMorosos();
        await loadClientes();

        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 3000);

    } catch (error) {
        messageDiv.textContent = '❌ Error de conexión con el servidor';
        messageDiv.className = 'message error';
        console.error('Error registrando pago:', error);
    }
});

// ============================================
// ENVIAR WHATSAPP A UN MOROSO
// ============================================
async function enviarWhatsApp(clienteId) {
    if (!confirm('¿Enviar recordatorio de pago por WhatsApp?')) return;

    try {
        const response = await fetch(`${API_URL}/api/enviar-whatsapp/${clienteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mes: new Date().getMonth() + 1,
                anio: new Date().getFullYear()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert('❌ Error: ' + (data.error || 'No se pudo enviar el mensaje'));
            return;
        }

        alert('✅ Mensaje enviado exitosamente a ' + data.cliente);
        await loadMorosos();

    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        alert('❌ Error de conexión con el servidor');
    }
}

// ============================================
// ENVIAR A TODOS LOS MOROSOS
// ============================================
document.getElementById('btnEnviarTodos').addEventListener('click', async () => {
    if (!confirm('¿Enviar recordatorios a TODOS los clientes morosos?')) return;

    try {
        const response = await fetch(`${API_URL}/api/enviar-recordatorios-masivos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            alert('❌ Error: ' + (data.error || 'No se pudo enviar los mensajes'));
            return;
        }

        alert(`✅ ${data.message}`);
        await loadMorosos();

    } catch (error) {
        console.error('Error enviando recordatorios masivos:', error);
        alert('❌ Error de conexión con el servidor');
    }
});

// ============================================
// EVENTO: LOGIN
// ============================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const codigo = document.getElementById('codigo').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.textContent = '';

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
        await Promise.all([
            loadClientes(),
            loadPlanes(),
            loadMorosos()
        ]);
        await cargarClientesEnSelect();
        document.getElementById('loginForm').reset();

    } catch (error) {
        errorDiv.textContent = '❌ Error de conexión con el servidor';
        console.error('Error en login:', error);
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
// INICIAR APLICACIÓN
// ============================================
checkAuth();
