// 1. Importaciones
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// 2. Configuración
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

// Variables y Constantes
const pageHeader = document.getElementById('page-header');
const userEmailDisplay = document.getElementById('user-email-display');
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const COSTO_HORA_FIJO = 2.50; // Constante de 2.50 Bs

// 3. LÓGICA DE AUTENTICACIÓN
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario dentro
        loginView.classList.add('hidden');
        pageHeader.classList.remove('hidden');
        appView.classList.remove('hidden');
        userEmailDisplay.textContent = user.email; // Mostrar el correo del usuario
        cargarHistorial(); // Cargar la tabla automáticamente al entrar
    } else {
        // No hay usuario
        loginView.classList.remove('hidden');
        pageHeader.classList.add('hidden');
        appView.classList.add('hidden');
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('error-msg');
    const btnSubmit = e.target.querySelector('button[type="submit"]');

    btnSubmit.innerText = "Entrando...";
    btnSubmit.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorMsg.classList.add('hidden');
    } catch (error) {
        errorMsg.classList.remove('hidden');
        console.error("Error de login:", error.message);
    } finally {
        btnSubmit.innerText = "Entrar";
        btnSubmit.disabled = false;
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// 4. LÓGICA DE LA CALCULADORA
document.getElementById('presupuesto-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    if(!auth.currentUser) return alert("Debes iniciar sesión");

    const nombre = document.getElementById('nombre-pieza').value;
    const peso = parseFloat(document.getElementById('peso-gramos').value);
    const precioBobina = parseFloat(document.getElementById('precio-bobina').value);
    const horas = parseFloat(document.getElementById('horas-impresion').value);
    const margen = parseFloat(document.getElementById('margen').value);

    // Cálculos con la variable fija
    const costoMaterial = (peso / 1000) * precioBobina;
    const costoMaquina = horas * COSTO_HORA_FIJO; // Usamos la constante aquí
    const costoTotalBase = costoMaterial + costoMaquina;
    const precioVenta = costoTotalBase * (1 + (margen / 100));

    // Formato Bolivianos
    document.getElementById('precio-final').innerText = `${precioVenta.toFixed(2)} Bs`;

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    btnSubmit.innerText = "Guardando...";
    btnSubmit.disabled = true;

    try {
        await addDoc(collection(db, "presupuestos"), {
            userId: auth.currentUser.uid,
            proyecto: nombre,
            costoTotalBase: parseFloat(costoTotalBase.toFixed(2)),
            margenAplicado: margen,
            precioFinalVenta: parseFloat(precioVenta.toFixed(2)),
            fecha: new Date().toISOString() 
        });
        
        e.target.reset(); 
        document.getElementById('margen').value = 50; // Regresa el margen a 50% por defecto
        document.getElementById('precio-final').innerText = "0.00 Bs";
        
        // Recargar el historial para ver el nuevo presupuesto inmediatamente
        cargarHistorial();

    } catch (error) {
        console.error("Error Firestore: ", error);
        alert("Error al guardar el presupuesto.");
    } finally {
        btnSubmit.innerText = "Calcular y Guardar";
        btnSubmit.disabled = false;
    }
});

// 5. FUNCIÓN PARA CARGAR EL HISTORIAL
async function cargarHistorial() {
    const tbody = document.getElementById('historial-body');
    tbody.innerHTML = "<tr><td colspan='3'>Cargando presupuestos...</td></tr>";

    try {
        const q = query(collection(db, "presupuestos"), where("userId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        let presupuestos = [];
        querySnapshot.forEach((doc) => {
            presupuestos.push(doc.data());
        });

        // Ordenar del más nuevo al más viejo
        presupuestos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        tbody.innerHTML = "";
        
        if(presupuestos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='3'>Aún no has guardado ningún presupuesto.</td></tr>";
            return;
        }

        presupuestos.forEach(p => {
            const fechaLegible = new Date(p.fecha).toLocaleDateString('es-BO', { 
                day: '2-digit', month: '2-digit', year: '2-digit'
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fechaLegible}</td>
                <td><strong>${p.proyecto}</strong></td>
                <td style="color:#16a085; font-weight:bold;">${p.precioFinalVenta.toFixed(2)} Bs</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar historial:", error);
        tbody.innerHTML = "<tr><td colspan='3'>Error al cargar los datos.</td></tr>";
    }
}