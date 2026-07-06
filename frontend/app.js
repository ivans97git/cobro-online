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
            await cargarPlanesEnSelect();
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
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const tabName = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        // Ocultar detalle de cliente al cambiar de tab
        document.getElementById('detalleCliente').style.display = 'none';
        
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
            document.getElementById('resultadosBusqueda').textContent = `📋 Total: ${clientes.length} clientes`;
            
            if (clientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay clientes registrados</td></tr>';
                return;
            }

            tbody.innerHTML = clientes.map(c => `
                <tr>
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.cedula || '-'}</td>
                    <td>${c.telefono}</td>
                    <td>${c.plan_nombre || 'Sin plan'} (${c.velocidad || ''})</td>
                    <td><span class="badge" style="background:${c.activo ? '#10b981' : '#ef4444'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td><button class="btn-search" onclick="verDetalleCliente(${c.id})">📋 Ver Historial</button></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

// ============================================
// BUSCAR CLIENTES
// ============================================
async function buscarClientes(termino) {
    try {
        if (!termino || termino.trim() === '') {
            document.getElementById('resultadosBusqueda').textContent = '';
            return loadClientes();
        }

        const response = await fetch(`${API_URL}/api/clientes/buscar?termino=${encodeURIComponent(termino)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const tbody = document.getElementById('clientesTableBody');
            
            document.getElementById('resultadosBusqueda').textContent = 
                `🔍 ${data.count} resultados encontrados para "${termino}"`;

            if (data.count === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No se encontraron clientes para "${termino}"</td></tr>`;
                return;
            }

            tbody.innerHTML = data.clientes.map(c => `
                <tr>
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.cedula || '-'}</td>
                    <td>${c.telefono}</td>
                    <td>${c.plan_nombre || 'Sin plan'} (${c.velocidad || ''})</td>
                    <td><span class="badge" style="background:${c.activo ? '#10b981' : '#ef4444'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td><button class="btn-search" onclick="verDetalleCliente(${c.id})">📋 Ver Historial</button></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error buscando clientes:', error);
        document.getElementById('resultadosBusqueda').textContent = '❌ Error en la búsqueda';
    }
}

// ============================================
// LIMPIAR BÚSQUEDA
// ============================================
function limpiarBusqueda() {
    document.getElementById('buscarCliente').value = '';
    document.getElementById('resultadosBusqueda').textContent = '';
    loadClientes();
}

// ============================================
// VER DETALLE DE CLIENTE (CON HISTORIAL DE PAGOS)
// ============================================
async function verDetalleCliente(clienteId) {
    try {
        const response = await fetch(`${API_URL}/api/clientes/${clienteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const cliente = await response.json();
            
            // Mostrar panel de detalle
            const detalleDiv = document.getElementById('detalleCliente');
            detalleDiv.style.display = 'block';
            
            // Información del cliente
            document.getElementById('detalleClienteNombre').textContent = `📋 Historial de Pagos - ${cliente.nombre}`;
            
            document.getElementById('infoCliente').innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
                    <div><strong>Nombre:</strong> ${cliente.nombre}</div>
                    <div><strong>Cédula:</strong> ${cliente.cedula || '-'}</div>
                    <div><strong>Teléfono:</strong> ${cliente.telefono}</div>
                    <div><strong>Plan:</strong> ${cliente.plan_nombre || 'Sin plan'} (${cliente.velocidad || ''})</div>
                    <div><strong>Instalación:</strong> ${cliente.fecha_instalacion || '-'}</div>
                    <div><strong>Estado:</strong> <span class="badge" style="background:${cliente.activo ? '#10b981' : '#ef4444'}">${cliente.activo ? 'Activo' : 'Inactivo'}</span></div>
                </div>
            `;
            
            // Historial de pagos
            const historialBody = document.getElementById('historialTableBody');
            const pagos = cliente.historial_pagos || [];
            
            if (pagos.length === 0) {
                historialBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay pagos registrados para este cliente</td></tr>';
            } else {
                const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                historialBody.innerHTML = pagos.map(p => `
                    <tr>
                        <td>${meses[p.mes - 1]} ${p.anio}</td>
                        <td>$${p.monto.toLocaleString()}</td>
                        <td>${p.metodo_pago}</td>
                        <td>${p.cobrador_nombre || 'Desconocido'}</td>
                        <td>${new Date(p.fecha_pago).toLocaleDateString()}</td>
                    </tr>
                `).join('');
            }
            
            // Resumen de pagos
            const totalPagado = cliente.total_pagado || 0;
            const totalPagos = cliente.total_pagos || 0;
            const deuda = cliente.total_deuda || 0;
            
            document.getElementById('resumenPagos').innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
                    <div><strong>💰 Total Pagado:</strong> $${totalPagado.toLocaleString()}</div>
                    <div><strong>📋 Total Pagos:</strong> ${totalPagos}</div>
                    <div><strong>⚠️ Deuda Pendiente:</strong> $${deuda.toLocaleString()}</div>
                    <div><strong>📊 Meses al día:</strong> ${cliente.pago_mes_actual ? '✅ Sí' : '❌ No'}</div>
                </div>
            `;
            
            // Scroll al detalle
            detalleDiv.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error obteniendo detalle del cliente:', error);
        alert('❌ Error al cargar el historial del cliente');
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
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">🎉 No hay clientes morosos</td></tr>';
                return;
            }

            tbody.innerHTML = morosos.map(m => `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td>${m.cedula || '-'}</td>
                    <td>${m.telefono}</td>
                    <td>${m.plan_nombre || 'Sin plan'}</td>
                    <td>${m.meses_deuda?.length || 0} meses</td>
                    <td>$${m.total_deuda?.toLocaleString() || 0}</td>
                    <td>
                        <button class="btn-whatsapp" onclick="enviarWhatsApp(${m.id})">📱 WhatsApp</button>
                        <button class="btn-search" onclick="verDetalleCliente(${m.id})">📋 Historial</button>
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
                select.innerHTML += `<option value="${c.id}">${c.nombre} - ${c.cedula || 'Sin cédula'} (${c.plan_nombre || 'Sin plan'})</option>`;
            });
        }
    } catch (error) {
        console.error('Error cargando clientes en select:', error);
    }
}

// ============================================
// CARGAR PLANES EN SELECT
// ============================================
async function cargarPlanesEnSelect() {
    try {
        const response = await fetch(`${API_URL}/api/planes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const planes = await response.json();
            const select = document.getElementById('clientePlan');
            
            select.innerHTML = '<option value="">Seleccionar plan...</option>';
            planes.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${p.nombre} - ${p.velocidad} ($${p.precio.toLocaleString()})</option>`;
            });
        }
    } catch (error) {
        console.error('Error cargando planes en select:', error);
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
        document.getElementById('anioPago').value = '2025';
        
        // Recargar datos
        await loadMorosos();
        await loadClientes();
        await cargarClientesEnSelect();

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
// CREAR NUEVO CLIENTE
// ============================================
document.getElementById('btnNuevoCliente').addEventListener('click', () => {
    document.getElementById('modalCliente').style.display = 'flex';
    document.getElementById('clienteForm').reset();
    document.getElementById('clienteMessage').textContent = '';
    document.getElementById('clienteMessage').className = 'message';
});

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modalCliente').style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalCliente')) {
        document.getElementById('modalCliente').style.display = 'none';
    }
});

document.getElementById('clienteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        nombre: document.getElementById('clienteNombre').value.trim(),
        cedula: document.getElementById('clienteCedula').value.trim(),
        telefono: document.getElementById('clienteTelefono').value.trim(),
        direccion: document.getElementById('clienteDireccion').value.trim(),
        email: document.getElementById('clienteEmail').value.trim(),
        plan_id: parseInt(document.getElementById('clientePlan').value),
        fecha_instalacion: document.getElementById('clienteFechaInstalacion').value
    };

    const messageDiv = document.getElementById('clienteMessage');
    messageDiv.textContent = '';
    messageDiv.className = 'message';

    if (!formData.nombre || !formData.telefono || !formData.plan_id) {
        messageDiv.textContent = '❌ Nombre, teléfono y plan son requeridos';
        messageDiv.className = 'message error';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            messageDiv.textContent = data.error || '❌ Error al crear cliente';
            messageDiv.className = 'message error';
            return;
        }

        messageDiv.textContent = '✅ Cliente creado exitosamente';
        messageDiv.className = 'message success';
        
        document.getElementById('modalCliente').style.display = 'none';
        await loadClientes();
        await cargarClientesEnSelect();

    } catch (error) {
        messageDiv.textContent = '❌ Error de conexión con el servidor';
        messageDiv.className = 'message error';
        console.error('Error creando cliente:', error);
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
// EVENTOS DEL BUSCADOR
// ============================================
document.getElementById('btnBuscar').addEventListener('click', () => {
    const termino = document.getElementById('buscarCliente').value.trim();
    if (termino === '') {
        alert('Por favor, ingrese un término de búsqueda');
        return;
    }
    buscarClientes(termino);
});

document.getElementById('btnLimpiar').addEventListener('click', limpiarBusqueda);

document.getElementById('buscarCliente').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const termino = document.getElementById('buscarCliente').value.trim();
        if (termino !== '') {
            buscarClientes(termino);
        }
    }
});

// Búsqueda en tiempo real (opcional)
// let timeoutId;
// document.getElementById('buscarCliente').addEventListener('input', (e) => {
//     clearTimeout(timeoutId);
//     const termino = e.target.value.trim();
//     if (termino === '') {
//         limpiarBusqueda();
//         return;
//     }
//     timeoutId = setTimeout(() => buscarClientes(termino), 500);
// });

// ============================================
// CERRAR DETALLE DE CLIENTE
// ============================================
document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
    document.getElementById('detalleCliente').style.display = 'none';
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
        await cargarPlanesEnSelect();
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
