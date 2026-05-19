import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDlj9X40xTsB2n0fiuJ3Vzt689Vhn8J_cs",
  authDomain: "krea-d70de.firebaseapp.com",
  projectId: "krea-d70de",
  storageBucket: "krea-d70de.firebasestorage.app",
  messagingSenderId: "572924587256",
  appId: "1:572924587256:web:50e9c1bca377dd80719f0d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const COSTO_HORA_FIJO = 2.50; 
let presupuestosGlobales = []; // Guardará los datos cargados para no volver a consultar a Firebase al abrir el popup

// --- MANEJO DE VISTAS ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const pageHeader = document.getElementById('page-header');
const modal = document.getElementById('edit-modal');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginView.classList.add('hidden');
        pageHeader.classList.remove('hidden');
        appView.classList.remove('hidden');
        document.getElementById('user-email-display').textContent = user.email;
        cargarHistorial(); 
    } else {
        loginView.classList.remove('hidden');
        pageHeader.classList.add('hidden');
        appView.classList.add('hidden');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
        document.getElementById('error-msg').classList.add('hidden');
    } catch (error) { document.getElementById('error-msg').classList.remove('hidden'); }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- LÓGICA DE COSTOS ADICIONALES DINÁMICOS ---
function crearFilaAdicional(desc = '', precio = '') {
    const div = document.createElement('div');
    div.className = 'adicional-row';
    div.innerHTML = `
        <input type="text" class="desc-input" placeholder="Detalle (Ej: Luces)" value="${desc}" required>
        <input type="number" step="0.1" class="precio-input" placeholder="Bs" value="${precio}" required>
        <button type="button" class="btn-remove-adicional" title="Eliminar">X</button>
    `;
    div.querySelector('.btn-remove-adicional').addEventListener('click', () => {
        div.remove();
        recalcularModal(); // Por si estamos en la vista de edición
    });
    // Agregar listeners para recalcular en vivo en el modal
    div.querySelectorAll('input').forEach(input => input.addEventListener('input', recalcularModal));
    return div;
}

// Botones para agregar filas
document.getElementById('btn-add-adicional').addEventListener('click', () => {
    document.getElementById('lista-adicionales').appendChild(crearFilaAdicional());
});
document.getElementById('btn-edit-add-adicional').addEventListener('click', () => {
    document.getElementById('edit-lista-adicionales').appendChild(crearFilaAdicional());
});

// Extraer datos de los adicionales
function obtenerAdicionales(containerId) {
    let adicionales = [];
    let total = 0;
    document.getElementById(containerId).querySelectorAll('.adicional-row').forEach(row => {
        const desc = row.querySelector('.desc-input').value;
        const precio = parseFloat(row.querySelector('.precio-input').value) || 0;
        if(desc && precio > 0) {
            adicionales.push({ descripcion: desc, precio: precio });
            total += precio;
        }
    });
    return { list: adicionales, total: total };
}

// --- GUARDAR NUEVO PRESUPUESTO ---
document.getElementById('presupuesto-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    if(!auth.currentUser) return;

    const nombre = document.getElementById('nombre-pieza').value;
    const peso = parseFloat(document.getElementById('peso-gramos').value);
    const precioBobina = parseFloat(document.getElementById('precio-bobina').value);
    const horas = parseFloat(document.getElementById('horas-impresion').value);
    const margen = parseFloat(document.getElementById('margen').value);

    // Obtener adicionales
    const extras = obtenerAdicionales('lista-adicionales');

    const costoMaterial = (peso / 1000) * precioBobina;
    const costoMaquina = horas * COSTO_HORA_FIJO;
    // El costo base incluye ahora los extras
    const costoTotalBase = costoMaterial + costoMaquina + extras.total; 
    const precioVenta = costoTotalBase * (1 + (margen / 100));

    document.getElementById('precio-final').innerText = `${precioVenta.toFixed(2)} Bs`;

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    btnSubmit.innerText = "Guardando..."; btnSubmit.disabled = true;

    try {
        await addDoc(collection(db, "presupuestos"), {
            userId: auth.currentUser.uid,
            proyecto: nombre,
            peso: peso,
            precioBobina: precioBobina,
            horas: horas,
            adicionales: extras.list, // Guardamos el detalle de los extras
            totalAdicionales: extras.total,
            costoTotalBase: parseFloat(costoTotalBase.toFixed(2)),
            margenAplicado: margen,
            precioFinalVenta: parseFloat(precioVenta.toFixed(2)),
            fecha: new Date().toISOString() 
        });
        
        e.target.reset(); 
        document.getElementById('lista-adicionales').innerHTML = ''; // Limpiar extras
        document.getElementById('margen').value = 50; 
        document.getElementById('precio-final').innerText = "0.00 Bs";
        cargarHistorial();
    } catch (error) { console.error(error); alert("Error al guardar."); } 
    finally { btnSubmit.innerText = "Calcular y Guardar"; btnSubmit.disabled = false; }
});

// --- CARGAR HISTORIAL ---
async function cargarHistorial() {
    const tbody = document.getElementById('historial-body');
    tbody.innerHTML = "<tr><td colspan='4'>Cargando...</td></tr>";

    try {
        const q = query(collection(db, "presupuestos"), where("userId", "==", auth.currentUser.uid));
        const snapshot = await getDocs(q);
        
        presupuestosGlobales = [];
        snapshot.forEach((doc) => {
            presupuestosGlobales.push({ id: doc.id, ...doc.data() });
        });

        presupuestosGlobales.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        tbody.innerHTML = "";
        
        if(presupuestosGlobales.length === 0) return tbody.innerHTML = "<tr><td colspan='4'>No hay presupuestos.</td></tr>";

        presupuestosGlobales.forEach(p => {
            const tr = document.createElement('tr');
            const dateStr = new Date(p.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: '2-digit'});
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${p.proyecto}</strong></td>
                <td style="color:#00897b; font-weight:bold;">${p.precioFinalVenta.toFixed(2)} Bs</td>
                <td><button class="btn-ver-editar" data-id="${p.id}">Detalles</button></td>
            `;
            tbody.appendChild(tr);
        });

        // Asignar evento a los botones "Detalles"
        document.querySelectorAll('.btn-ver-editar').forEach(btn => {
            btn.addEventListener('click', (e) => abrirModal(e.target.getAttribute('data-id')));
        });

    } catch (error) { console.error(error); tbody.innerHTML = "<tr><td colspan='4'>Error al cargar.</td></tr>"; }
}

// --- LÓGICA DE LA VENTANA MODAL (VER/EDITAR) ---
function abrirModal(id) {
    const p = presupuestosGlobales.find(item => item.id === id);
    if(!p) return;

    // Rellenar formulario modal
    document.getElementById('edit-doc-id').value = p.id;
    document.getElementById('edit-nombre').value = p.proyecto;
    // Si los guardaste antes de esta actualización, puede que no existan, por eso ponemos "|| 0"
    document.getElementById('edit-peso').value = p.peso || 0;
    document.getElementById('edit-precio-bobina').value = p.precioBobina || 120;
    document.getElementById('edit-horas').value = p.horas || 0;
    document.getElementById('edit-margen').value = p.margenAplicado || 50;
    
    // Rellenar lista de adicionales
    const listaEditExtras = document.getElementById('edit-lista-adicionales');
    listaEditExtras.innerHTML = '';
    if(p.adicionales && p.adicionales.length > 0) {
        p.adicionales.forEach(extra => {
            listaEditExtras.appendChild(crearFilaAdicional(extra.descripcion, extra.precio));
        });
    }

    recalcularModal();
    modal.classList.remove('hidden');
}

// Cerrar Modal
document.getElementById('close-modal').addEventListener('click', () => modal.classList.add('hidden'));

// Recalcular el precio en vivo dentro del Modal
function recalcularModal() {
    const peso = parseFloat(document.getElementById('edit-peso').value) || 0;
    const precioBobina = parseFloat(document.getElementById('edit-precio-bobina').value) || 0;
    const horas = parseFloat(document.getElementById('edit-horas').value) || 0;
    const margen = parseFloat(document.getElementById('edit-margen').value) || 0;
    
    const extras = obtenerAdicionales('edit-lista-adicionales');

    const costoMaterial = (peso / 1000) * precioBobina;
    const costoMaquina = horas * COSTO_HORA_FIJO;
    const costoTotalBase = costoMaterial + costoMaquina + extras.total;
    const precioVenta = costoTotalBase * (1 + (margen / 100));

    document.getElementById('edit-precio-final').innerText = `${precioVenta.toFixed(2)} Bs`;
}

// Escuchar cambios en los inputs del modal para recalcular
document.querySelectorAll('#edit-form input').forEach(input => {
    input.addEventListener('input', recalcularModal);
});

// --- GUARDAR CAMBIOS (ACTUALIZAR EN FIREBASE) ---
document.getElementById('edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-doc-id').value;
    
    const peso = parseFloat(document.getElementById('edit-peso').value);
    const precioBobina = parseFloat(document.getElementById('edit-precio-bobina').value);
    const horas = parseFloat(document.getElementById('edit-horas').value);
    const margen = parseFloat(document.getElementById('edit-margen').value);
    const extras = obtenerAdicionales('edit-lista-adicionales');

    const costoTotalBase = ((peso / 1000) * precioBobina) + (horas * COSTO_HORA_FIJO) + extras.total;
    const precioVenta = costoTotalBase * (1 + (margen / 100));

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "Actualizando..."; btn.disabled = true;

    try {
        // Actualizar documento específico en Firestore
        const docRef = doc(db, "presupuestos", id);
        await updateDoc(docRef, {
            proyecto: document.getElementById('edit-nombre').value,
            peso: peso,
            precioBobina: precioBobina,
            horas: horas,
            adicionales: extras.list,
            totalAdicionales: extras.total,
            costoTotalBase: parseFloat(costoTotalBase.toFixed(2)),
            margenAplicado: margen,
            precioFinalVenta: parseFloat(precioVenta.toFixed(2))
        });
        
        modal.classList.add('hidden');
        cargarHistorial(); // Refrescar tabla
    } catch (error) { 
        console.error(error); alert("Error al actualizar."); 
    } finally { 
        btn.innerText = "Guardar Cambios"; btn.disabled = false; 
    }
});
