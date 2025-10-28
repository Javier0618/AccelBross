    // Import the functions you need from the SDKs you need
    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
    import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
    // Importa los módulos de Firebase Authentication
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, updateEmail } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
    // Importa los módulos de Firestore
    import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyD1HMDqXjD5blkaoNSdwuojl-WNJ6zW6Lo",
      authDomain: "accelbross.firebaseapp.com",
      projectId: "accelbross",
      storageBucket: "accelbross.firebasestorage.app",
      messagingSenderId: "831245484574",
      appId: "1:831245484574:web:8619ace129281755c7a40f",
      measurementId: "G-RGDRETKDV8"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
    const auth = getAuth(app); // Inicializa Firebase Authentication
    const db = getFirestore(app); // Inicializa Firestore

    // Hacer 'db' y 'auth' globales para que StorageManager y AuthManager puedan acceder a ellas
    window.db = db;
    window.auth = auth;

    // ===== CONSTANTS =====
    const DB_NAME = 'CeluStore_ERP_Modern';
    const DB_VERSION = 2; // Increment version for new stores
    const STORE_NAMES = ['products', 'suppliers', 'purchases', 'sales', 'customers', 'settings', 'expenses', 'accountsReceivable', 'accountsPayable', 'users'];

    // ===== AUTH MANAGER (MODIFICADO PARA FIREBASE AUTH) =====
    class AuthManager {
      constructor() {
        this.currentUser = null; // Objeto de usuario de Firebase Auth
        this.userProfile = null; // Perfil de usuario de Firestore (contiene el rol)
        this.isAdmin = false; // Flag para verificar si el usuario actual es Javier (Administrador)
        this.isInitialized = false; // Nuevo flag para controlar la inicialización
      }

      async init() {
        // Escuchar cambios en el estado de autenticación
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            this.currentUser = user;
            // Obtener el perfil de usuario de Firestore para obtener el rol
            try {
              const userDoc = await storage.get('users', user.uid);
              if (userDoc) {
                this.userProfile = userDoc;
                this.isAdmin = userDoc.role === 'Javier';
                ui.updateUserDisplay();
                // Solo navegar al dashboard si no estamos ya en la aplicación principal
                // y si el AuthManager ya está completamente inicializado.
                // Esto evita múltiples redirecciones o redirecciones antes de que todo esté listo.
                if (!this.isInitialized) {
                    document.getElementById('loginScreen').style.display = 'none';
                    document.getElementById('appContainer').style.display = 'flex';
                    ui.navigateTo('dashboard');
                    this.isInitialized = true; // Marcar como inicializado después de la primera navegación exitosa
                }
              } else {
                // Si el usuario está autenticado en Auth pero no tiene perfil en Firestore,
                // podría ser un nuevo registro que necesita completar su perfil, o un error.
                console.warn("Usuario autenticado pero sin perfil en Firestore:", user.uid);
                // Forzar cierre de sesión para evitar un estado inconsistente
                ui.showToast("Perfil de usuario no encontrado. Por favor, contacta al administrador.");
                this.logout();
              }
            } catch (error) {
                console.error("Error al obtener el perfil de usuario de Firestore:", error);
                ui.showToast("Error al cargar el perfil de usuario. Por favor, intenta de nuevo.");
                this.logout(); // Forzar cierre de sesión si hay un error al cargar el perfil
            }
          } else {
            this.currentUser = null;
            this.userProfile = null;
            this.isAdmin = false;
            this.isInitialized = false; // Resetear el estado de inicialización
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
          }
        });
      }

      async login(email, password) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          // onAuthStateChanged manejará la actualización de this.currentUser y this.userProfile
          // y la navegación al dashboard.
          ui.showToast('Inicio de sesión exitoso');
          return true;
        } catch (error) {
          console.error("Error al iniciar sesión:", error.code, error.message);
          let errorMessage = "Error al iniciar sesión.";
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "Email o contraseña incorrectos.";
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Formato de email inválido.";
          } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "Demasiados intentos fallidos. Intenta de nuevo más tarde.";
          }
          ui.showToast(errorMessage);
          return false;
        }
      }

      async register(email, password, role) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          // Guardar el perfil del usuario en Firestore
          await setDoc(doc(db, 'users', user.uid), {
            email: email,
            role: role,
            username: email.split('@')[0], // Nombre de usuario simple basado en email
            createdAt: new Date().toISOString()
          });
          ui.showToast('Usuario registrado exitosamente. Por favor, inicia sesión.');
          // Después de registrar, cerrar sesión automáticamente al nuevo usuario
          // para que el usuario pueda iniciar sesión con sus nuevas credenciales.
          await signOut(auth);
          return true;
        } catch (error) {
          console.error("Error al registrar usuario:", error.code, error.message);
          let errorMessage = "Error al registrar usuario.";
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = "El email ya está en uso.";
          } else if (error.code === 'auth/weak-password') {
            errorMessage = "La contraseña es demasiado débil (mínimo 6 caracteres).";
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Formato de email inválido.";
          }
          ui.showToast(errorMessage);
          return false;
        }
      }

      async logout() {
        try {
          await signOut(auth);
          ui.showToast('Sesión cerrada.');
        } catch (error) {
          console.error("Error al cerrar sesión:", error);
          ui.showToast('Error al cerrar sesión.');
        }
      }

      // Este método ahora verifica el rol del usuario actual desde su perfil de Firestore
      hasPermission(requiredRoles) {
        if (!this.userProfile) {
            console.warn("hasPermission: userProfile is null. Denying access.");
            return false;
        }
        return requiredRoles.includes(this.userProfile.role);
      }

      // Método para crear un nuevo usuario (solo para administradores)
      async createNewUser(email, password, role) {
        if (!this.isAdmin) {
          ui.showToast('Permiso denegado: Solo administradores pueden crear usuarios.');
          return false;
        }
        try {
          // **ADVERTENCIA DE SEGURIDAD:**
          // Crear usuarios de Auth directamente desde el cliente con roles específicos
          // y sin desloguear al administrador es una operación que DEBERÍA hacerse
          // a través de Firebase Cloud Functions (usando Firebase Admin SDK).
          // Este código es una SIMULACIÓN para el frontend y tiene limitaciones.
          // `createUserWithEmailAndPassword` autentica al usuario recién creado,
          // lo que podría desloguear al administrador si no se maneja cuidadosamente.
          // Para este ejemplo, simplemente creamos el usuario y su perfil.
          // En un entorno real, el admin llamaría a una Cloud Function para esto.

          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;

          // Guardar el perfil del nuevo usuario en Firestore
          await setDoc(doc(db, 'users', newUser.uid), {
            email: email,
            role: role,
            username: email.split('@')[0],
            createdAt: new Date().toISOString()
          });

          // Si el administrador estaba logueado, `createUserWithEmailAndPassword`
          // lo desloguea y loguea al nuevo usuario. Para mantener al admin logueado,
          // necesitaríamos re-autenticar al admin o usar Cloud Functions.
          // Para este ejemplo, simplemente cerramos la sesión del nuevo usuario
          // para que el admin pueda continuar.
          await signOut(auth); // Cierra la sesión del nuevo usuario
          // Luego, el onAuthStateChanged volverá a detectar al admin si estaba logueado.

          ui.showToast(`Usuario ${email} creado con rol ${role}.`);
          return true;
        } catch (error) {
          console.error("Error al crear nuevo usuario:", error);
          let errorMessage = "Error al crear usuario.";
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = "El email ya está en uso.";
          } else if (error.code === 'auth/weak-password') {
            errorMessage = "La contraseña es demasiado débil (mínimo 6 caracteres).";
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Formato de email inválido.";
          }
          ui.showToast(errorMessage);
          return false;
        }
      }

      // Método para actualizar el perfil de usuario en Firestore
      async updateUserProfile(userId, updatedData) {
        if (!this.isAdmin) {
          ui.showToast('Permiso denegado: Solo administradores pueden editar perfiles de usuario.');
          return false;
        }
        try {
          await storage.update('users', { id: userId, ...updatedData });
          ui.showToast('Perfil de usuario actualizado.');
          return true;
        } catch (error) {
          console.error("Error al actualizar perfil de usuario:", error);
          ui.showToast(`Error al actualizar perfil: ${error.message}`);
          return false;
        }
      }

      // Método para actualizar la contraseña de un usuario (SIMULACIÓN para el frontend)
      async updateUserPasswordByAdmin(userId, newPassword) {
        if (!this.isAdmin) {
          ui.showToast('Permiso denegado: Solo administradores pueden cambiar contraseñas.');
          return false;
        }
        if (newPassword.length < 6) {
            ui.showToast('La contraseña debe tener al menos 6 caracteres.');
            return false;
        }
        // **ADVERTENCIA DE SEGURIDAD:**
        // Esta es una SIMULACIÓN. En un entorno de producción, NO se puede cambiar
        // la contraseña de otro usuario directamente desde el cliente.
        // Se DEBE usar Firebase Admin SDK a través de una Cloud Function.
        // Aquí, simplemente mostraremos un mensaje de éxito simulado.
        console.warn(`SIMULACIÓN: Contraseña del usuario ${userId} cambiada a ${newPassword}. En producción, esto requeriría Cloud Functions.`);
        ui.showToast('Contraseña actualizada (simulado). En producción, esto requiere Cloud Functions.');
        return true;
      }

      // Método para eliminar un usuario (SIMULACIÓN para el frontend)
      async deleteUserByAdmin(userId) {
        if (!this.isAdmin) {
          ui.showToast('Permiso denegado: Solo administradores pueden eliminar usuarios.');
          return false;
        }
        if (this.currentUser && this.currentUser.uid === userId) {
            ui.showToast('No puedes eliminar tu propia cuenta.');
            return false;
        }
        try {
          // **ADVERTENCIA DE SEGURIDAD:**
          // Esta es una SIMULACIÓN. En un entorno de producción, NO se puede eliminar
          // la cuenta de Firebase Auth de otro usuario directamente desde el cliente.
          // Se DEBE usar Firebase Admin SDK a través de una Cloud Function.
          // Aquí, solo eliminaremos el perfil de Firestore.
          await storage.delete('users', userId);
          ui.showToast('Perfil de usuario eliminado de Firestore. (La cuenta de Auth puede persistir sin Cloud Functions)');
          return true;
        } catch (error) {
          console.error("Error al eliminar usuario:", error);
          ui.showToast(`Error al eliminar usuario: ${error.message}`);
          return false;
        }
      }
    }

    // ===== STORAGE MANAGER (MODIFICADO PARA FIREBASE) =====
    class StorageManager {
      constructor() {
        this.db = null; // Ahora será la instancia de Firestore
        this.fallbackMode = false; // No usaremos localStorage como fallback si Firebase es la principal
      }

      async init() {
        // La instancia de Firestore 'db' ya está disponible globalmente a través de window.db
        this.db = window.db;
        if (!this.db) {
            console.error("Firestore no inicializado. Asegúrate de que 'db' esté disponible globalmente.");
            this.fallbackMode = true;
            ui.showToast("Error: Firestore no está disponible. Algunas funciones pueden no guardar datos.");
            return;
        }
        console.log("Firestore inicializado y listo para usar.");
      }

      async get(storeName, id = null) {
        if (this.fallbackMode) {
          const data = JSON.parse(localStorage.getItem(`${DB_NAME}_${storeName}`) || '[]');
          if (id !== null) {
            return data.find(item => String(item.id) === String(id)) || null;
          }
          return data;
        }

        try {
          if (id !== null) {
            const docRef = doc(this.db, storeName, String(id));
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              return { id: docSnap.id, ...docSnap.data() };
            } else {
              return null;
            }
          } else {
            const querySnapshot = await getDocs(collection(this.db, storeName));
            const data = [];
            querySnapshot.forEach((d) => {
              data.push({ id: d.id, ...d.data() });
            });
            return data;
          }
        } catch (error) {
          console.error(`Error al obtener datos de Firestore para ${storeName}:`, error);
          ui.showToast(`Error al cargar ${storeName}. Revisa la consola.`);
          return [];
        }
      }

      async set(storeName, data) {
        if (this.fallbackMode) {
          localStorage.setItem(`${DB_NAME}_${storeName}`, JSON.stringify(data));
          return;
        }

        try {
          const existingDocsSnapshot = await getDocs(collection(this.db, storeName));
          const deleteBatch = writeBatch(this.db);
          existingDocsSnapshot.forEach((d) => {
            deleteBatch.delete(doc(this.db, storeName, d.id));
          });
          await deleteBatch.commit();

          if (Array.isArray(data) && data.length > 0) {
            const addBatch = writeBatch(this.db);
            for (const item of data) {
              // Si el item ya tiene un ID (ej. de un backup o de una operación previa), úsalo.
              // De lo contrario, Firestore generará uno.
              const docRef = item.id ? doc(this.db, storeName, String(item.id)) : doc(collection(this.db, storeName));
              const { id, ...itemWithoutId } = item; // Excluir 'id' si se usa setDoc con un ID explícito
              await addBatch.set(docRef, itemWithoutId); // Usar await para cada set en el batch
            }
            await addBatch.commit();
          }
        } catch (error) {
          console.error(`Error al establecer datos en Firestore para ${storeName}:`, error);
          ui.showToast(`Error al guardar ${storeName}. Revisa la consola.`);
        }
      }

      async add(storeName, item) {
        if (this.fallbackMode) {
          const data = JSON.parse(localStorage.getItem(`${DB_NAME}_${storeName}`) || '[]');
          item.id = data.length ? Math.max(...data.map(i => parseInt(i.id) || 0)) + 1 : 1;
          data.push(item);
          localStorage.setItem(`${DB_NAME}_${storeName}`, JSON.stringify(data));
          return item.id;
        }

        try {
          const docRef = await addDoc(collection(this.db, storeName), item);
          return docRef.id;
        } catch (error) {
          console.error(`Error al añadir datos a Firestore para ${storeName}:`, error);
          ui.showToast(`Error al añadir ${storeName}. Revisa la consola.`);
          throw error;
        }
      }

      async update(storeName, item) {
        if (this.fallbackMode) {
          const data = JSON.parse(localStorage.getItem(`${DB_NAME}_${storeName}`) || '[]');
          const index = data.findIndex(i => String(i.id) === String(item.id));
          if (index !== -1) {
            data[index] = { ...data[index], ...item };
            localStorage.setItem(`${DB_NAME}_${storeName}`, JSON.stringify(data));
          }
          return;
        }

        try {
          if (!item.id) {
            throw new Error("El item a actualizar debe tener un ID.");
          }
          const docRef = doc(this.db, storeName, String(item.id));
          const { id, ...itemWithoutId } = item;
          await updateDoc(docRef, itemWithoutId);
        } catch (error) {
          console.error(`Error al actualizar datos en Firestore para ${storeName}:`, error);
          ui.showToast(`Error al actualizar ${storeName}. Revisa la consola.`);
          throw error;
        }
      }

      async delete(storeName, id) {
        if (this.fallbackMode) {
          const data = JSON.parse(localStorage.getItem(`${DB_NAME}_${storeName}`) || '[]');
          const filtered = data.filter(item => String(item.id) !== String(id));
          localStorage.setItem(`${DB_NAME}_${storeName}`, JSON.stringify(filtered));
          return;
        }

        try {
          const docRef = doc(this.db, storeName, String(id));
          await deleteDoc(docRef);
        } catch (error) {
          console.error(`Error al eliminar datos de Firestore para ${storeName}:`, error);
          ui.showToast(`Error al eliminar ${storeName}. Revisa la consola.`);
          throw error;
        }
      }
    }

    // ===== UI MANAGER =====
    class UIManager {
      constructor() {
        this.activeTab = 'dashboard';
        this.toastTimeout = null;
        this.sidebarCollapsed = false;
      }

      navigateTo(tabId) {
        // Check permissions
        const navItem = document.querySelector(`[data-tab="${tabId}"]`);
        if (navItem) {
          const requiredRoles = navItem.dataset.roles ? navItem.dataset.roles.split(',') : [];
          // Asegurarse de que userProfile esté cargado antes de verificar permisos
          if (!authManager.userProfile || (requiredRoles.length > 0 && !authManager.hasPermission(requiredRoles))) {
            this.showToast('No tienes permiso para acceder a esta sección.');
            // Si no tiene permiso, redirigir a una página accesible o al login
            if (authManager.currentUser) {
                // Si está logueado pero sin permiso para esta sección, ir al dashboard
                // o a una página de "Acceso Denegado"
                console.warn(`Acceso denegado para el rol ${authManager.userProfile?.role} a la pestaña ${tabId}`);
                // Evitar bucle de redirección si el dashboard tampoco es accesible
                if (tabId !== 'dashboard') {
                    this.navigateTo('dashboard'); // Intenta ir al dashboard
                } else {
                    // Si ni siquiera el dashboard es accesible, algo está mal con los roles o las reglas
                    this.showToast('Tu rol no tiene acceso a ninguna sección. Contacta al administrador.');
                    authManager.logout(); // Forzar cierre de sesión
                }
            } else {
                // Si no está logueado, ir a la pantalla de login
                document.getElementById('loginScreen').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
            }
            return;
          }
        }

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
          tab.classList.remove('active');
        });
        document.querySelectorAll('.nav-item').forEach(link => {
          link.classList.remove('active');
        });

        const targetTab = document.getElementById(tabId);
        const targetNav = document.querySelector(`[data-tab="${tabId}"]`);
        
        if (targetTab) {
          targetTab.classList.add('active', 'fade-in');
        }
        if (targetNav) {
          targetNav.classList.add('active');
        }

        // Update page title
        const titles = {
          dashboard: 'Dashboard',
          products: 'Productos',
          sales: 'Ventas',
          customers: 'Clientes',
          purchases: 'Compras',
          suppliers: 'Proveedores',
          reports: 'Reportes',
          settings: 'Configuración',
          expenses: 'Gastos',
          'accounts-receivable': 'Cuentas por Cobrar',
          'accounts-payable': 'Cuentas por Pagar',
          'cash-report': 'Reporte de Caja',
          users: 'Gestión de Usuarios'
        };
        document.getElementById('pageTitle').textContent = titles[tabId] || 'Dashboard';

        this.activeTab = tabId;

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
          this.toggleSidebar(false);
        }

        // Load tab-specific data
        this.loadTabData(tabId);
      }

      loadTabData(tabId) {
        switch(tabId) {
          case 'dashboard':
            dashboardManager.loadDashboard();
            break;
          case 'products':
            productManager.loadProducts();
            break;
          case 'sales':
            saleManager.loadSales();
            break;
          case 'customers':
            customerManager.loadCustomers();
            break;
          case 'purchases':
            purchaseManager.loadPurchases();
            purchaseManager.loadSuppliersForFilter();
            break;
          case 'suppliers':
            supplierManager.loadSuppliers();
            break;
          case 'expenses':
            expenseManager.loadExpenses();
            break;
          case 'accounts-receivable':
            accountsReceivableManager.loadAccountsReceivable();
            break;
          case 'accounts-payable':
            accountsPayableManager.loadAccountsPayable();
            break;
          case 'cash-report':
            cashReportManager.loadCashReport();
            break;
          case 'settings':
            settingsManager.loadSettings();
            break;
          case 'reports':
            // Clear report content when navigating to reports tab
            document.getElementById('reportContent').innerHTML = '<p class="text-center text-muted-foreground">Selecciona los parámetros y genera un reporte</p>';
            document.getElementById('reportCardTitle').textContent = 'Reporte Generado';
            break;
          case 'users':
            userManager.loadUsers();
            break;
        }
      }

      toggleSidebar(force = null) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (force !== null) {
          this.sidebarCollapsed = !force;
        } else {
          this.sidebarCollapsed = !this.sidebarCollapsed;
        }
        
        if (window.innerWidth <= 768) {
          sidebar.classList.toggle('open', !this.sidebarCollapsed);
          // No need to toggle 'collapsed' on mobile, 'open' handles visibility
        } else {
          sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
          mainContent.classList.toggle('expanded', this.sidebarCollapsed);
        }
      }

      showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');

        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
          toast.classList.remove('show');
        }, duration);
      }

      showModal(title, body, onSave, showSaveButton = true) {
        const modal = document.getElementById('modalOverlay');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = body;
        document.getElementById('btnModalSave').onclick = onSave;
        document.getElementById('btnModalCancel').onclick = () => this.closeModal();
        document.getElementById('modalClose').onclick = () => this.closeModal();

        if (showSaveButton) {
          document.getElementById('btnModalSave').style.display = 'inline-flex';
        } else {
          document.getElementById('btnModalSave').style.display = 'none';
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      closeModal() {
        const modal = document.getElementById('modalOverlay');
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }

      confirmAction(message, onConfirm) {
        if (confirm(message)) {
          onConfirm();
        }
      }

      formatCurrency(amount) {
        const currency = settingsManager.settings.currency || 'COP';
        if (currency === 'USD') {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
        } else if (currency === 'EUR') {
          return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
        } else {
          return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
        }
      }

      toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        
        // Save theme preference
        settingsManager.settings.theme = newTheme;
        settingsManager.saveSettings();
      }

      updateUserDisplay() {
        if (authManager.currentUser && authManager.userProfile) {
          document.getElementById('userAvatar').textContent = authManager.userProfile.username.charAt(0).toUpperCase();
          document.getElementById('userName').textContent = authManager.userProfile.username;
          
          let displayedRole = '';
          if (authManager.userProfile.role === 'Javier') {
            displayedRole = 'Administrador';
          } else if (authManager.userProfile.role === 'Diego') {
            displayedRole = 'Cajero';
          } else if (authManager.userProfile.role === 'Nena') {
            displayedRole = 'Bodeguero';
          }
          document.getElementById('userRole').textContent = `(${displayedRole})`;
        }
        this.updateNavigationVisibility();
      }

      updateNavigationVisibility() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        navItems.forEach(item => {
          const roles = item.dataset.roles ? item.dataset.roles.split(',') : [];
          // Solo ocultar si hay roles definidos y el usuario NO tiene permiso
          if (roles.length > 0 && !authManager.hasPermission(roles)) {
            item.style.display = 'none';
          } else {
            item.style.display = 'flex'; // Mostrar por defecto o si tiene permiso
          }
        });
      }
    }

    // ===== PRODUCT MANAGER =====
    class ProductManager {
      async loadProducts(filter = '') {
        const products = await storage.get('products');
        const tableBody = document.querySelector('#productsTable tbody');
        tableBody.innerHTML = '';

        const filtered = products.filter(p => 
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.sku.toLowerCase().includes(filter.toLowerCase()) ||
          p.category.toLowerCase().includes(filter.toLowerCase()) ||
          (p.imeis && p.imeis.some(imei => imei.toLowerCase().includes(filter.toLowerCase())))
        );

        const minStock = settingsManager.settings.minStock || 5;

        filtered.forEach(product => {
          const tr = document.createElement('tr');
          const stockStatus = product.stock <= minStock ? 'low-stock' : '';
          const stockBadge = product.stock <= minStock ? 
            `<span class="status-badge status-low-stock"><i class="fas fa-exclamation-triangle"></i> Stock Bajo</span>` :
            `<span class="status-badge status-paid"><i class="fas fa-check"></i> Disponible</span>`;

          tr.innerHTML = `
            <td>
              <img src="${product.image || 'https://via.placeholder.com/40x40?text=No+Image'}" 
                   alt="${product.name}" 
                   style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
            </td>
            <td><strong>${product.name}</strong><br><small>${product.description || ''}</small></td>
            <td><code>${product.sku}</code></td>
            <td><span class="status-badge">${product.category}</span></td>
            <td><strong>${product.stock}</strong> ${product.imeis && product.imeis.length > 0 ? `<br><small>${product.imeis.length} IMEI(s)</small>` : ''}</td>
            <td><strong>${ui.formatCurrency(product.sellPrice)}</strong></td>
            <td>${stockBadge}</td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${product.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-destructive" data-action="delete" data-id="${product.id}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async addProduct() {
        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-input" id="productName" required>
            </div>
            <div class="form-group">
              <label class="form-label">SKU *</label>
              <input type="text" class="form-input" id="productSKU" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Categoría</label>
              <select class="form-select" id="productCategory">
                <option value="Celulares">Celulares</option>
                <option value="Accesorios">Accesorios</option>
                <option value="Cargadores">Cargadores</option>
                <option value="Fundas">Fundas</option>
                <option value="Audífonos">Audífonos</option>
                <option value="Cables">Cables</option>
                <option value="Power Banks">Power Banks</option>
                <option value="Soportes">Soportes</option>
                <option value="Protectores">Protectores de Pantalla</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Stock Inicial</label>
              <input type="number" class="form-input" id="productStock" value="0" min="0">
              <small style="color: var(--muted-foreground);">Para productos sin IMEI/Lote</small>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Precio de Venta *</label>
              <input type="number" class="form-input" id="productSellPrice" step="0.01" min="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Precio de Compra</label>
              <input type="number" class="form-input" id="productCostPrice" step="0.01" min="0">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">IMEIs / Lotes (uno por línea, solo para celulares)</label>
            <textarea class="form-input" id="productIMEIs" rows="3" placeholder="IMEI1&#10;IMEI2&#10;LoteA-001"></textarea>
            <small style="color: var(--muted-foreground);">El stock se ajustará automáticamente por la cantidad de IMEIs/Lotes ingresados.</small>
          </div>
          <div class="form-group">
            <label class="form-label">URL de Imagen</label>
            <input type="text" class="form-input" id="productImage" placeholder="https://ejemplo.com/imagen.jpg">
          </div>
          <div class="form-group">
            <label class="form-label">Descripción</label>
            <textarea class="form-input" id="productDescription" rows="3" placeholder="Descripción del producto..."></textarea>
          </div>
        `;

        ui.showModal('Nuevo Producto', body, async () => {
          const productIMEIs = document.getElementById('productIMEIs').value.trim().split('\n').filter(line => line.length > 0);
          const isCellular = document.getElementById('productCategory').value === 'Celulares';
          
          let stock = parseInt(document.getElementById('productStock').value) || 0;
          if (isCellular && productIMEIs.length > 0) {
            stock = productIMEIs.length; // Stock is determined by IMEI count for cellular
          }

          const product = {
            name: document.getElementById('productName').value.trim(),
            sku: document.getElementById('productSKU').value.trim(),
            category: document.getElementById('productCategory').value,
            stock: stock,
            sellPrice: parseFloat(document.getElementById('productSellPrice').value) || 0,
            costPrice: parseFloat(document.getElementById('productCostPrice').value) || 0,
            avgCostPrice: parseFloat(document.getElementById('productCostPrice').value) || 0,
            image: document.getElementById('productImage').value.trim(),
            description: document.getElementById('productDescription').value.trim(),
            imeis: isCellular ? productIMEIs : [], // Only store IMEIs for cellular products
            createdAt: new Date().toISOString()
          };

          if (!product.name || !product.sku) {
            ui.showToast('Nombre y SKU son obligatorios');
            return;
          }

          try {
            await storage.add('products', product);
            ui.closeModal();
            ui.showToast('Producto agregado exitosamente');
            this.loadProducts();
          } catch (error) {
            console.error("Error adding product:", error);
            ui.showToast('Error al agregar producto.');
          }
        });

        // Add event listener to update stock based on IMEI count
        setTimeout(() => {
          const productCategorySelect = document.getElementById('productCategory');
          const productStockInput = document.getElementById('productStock');
          const productIMEIsTextarea = document.getElementById('productIMEIs');

          const updateStockFromIMEIs = () => {
            const isCellular = productCategorySelect.value === 'Celulares';
            if (isCellular) {
              const imeiCount = productIMEIsTextarea.value.trim().split('\n').filter(line => line.length > 0).length;
              productStockInput.value = imeiCount;
              productStockInput.readOnly = true;
            } else {
              productStockInput.readOnly = false;
            }
          };

          productCategorySelect.addEventListener('change', updateStockFromIMEIs);
          productIMEIsTextarea.addEventListener('input', updateStockFromIMEIs);
          updateStockFromIMEIs(); // Initial call
        }, 100);
      }

      async editProduct(id) {
        const product = await storage.get('products', id);
        if (!product) return;

        const isCellular = product.category === 'Celulares';
        const imeiInputHtml = isCellular ? `
          <div class="form-group">
            <label class="form-label">IMEIs / Lotes (uno por línea)</label>
            <textarea class="form-input" id="productIMEIs" rows="3" placeholder="IMEI1&#10;IMEI2&#10;LoteA-001">${product.imeis ? product.imeis.join('\n') : ''}</textarea>
            <small style="color: var(--muted-foreground);">El stock se ajustará automáticamente por la cantidad de IMEIs/Lotes ingresados.</small>
          </div>
        ` : '';

        const stockReadonly = isCellular ? 'readonly' : '';
        const stockHelpText = isCellular ? '<small style="color: var(--muted-foreground);">El stock se actualiza automáticamente por IMEIs/Lotes.</small>' : '<small style="color: var(--muted-foreground);">El stock se actualiza automáticamente con compras/ventas</small>';

        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-input" id="productName" value="${product.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">SKU *</label>
              <input type="text" class="form-input" id="productSKU" value="${product.sku}" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Categoría</label>
              <select class="form-select" id="productCategory">
                <option value="Celulares" ${product.category === 'Celulares' ? 'selected' : ''}>Celulares</option>
                <option value="Accesorios" ${product.category === 'Accesorios' ? 'selected' : ''}>Accesorios</option>
                <option value="Cargadores" ${product.category === 'Cargadores' ? 'selected' : ''}>Cargadores</option>
                <option value="Fundas" ${product.category === 'Fundas' ? 'selected' : ''}>Fundas</option>
                <option value="Audífonos" ${product.category === 'Audífonos' ? 'selected' : ''}>Audífonos</option>
                <option value="Cables" ${product.category === 'Cables' ? 'selected' : ''}>Cables</option>
                <option value="Power Banks" ${product.category === 'Power Banks' ? 'selected' : ''}>Power Banks</option>
                <option value="Soportes" ${product.category === 'Soportes' ? 'selected' : ''}>Soportes</option>
                <option value="Protectores" ${product.category === 'Protectores' ? 'selected' : ''}>Protectores de Pantalla</option>
                <option value="Otros" ${product.category === 'Otros' ? 'selected' : ''}>Otros</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Stock Actual</label>
              <input type="number" class="form-input" id="productStock" value="${product.stock}" min="0" ${stockReadonly}>
              ${stockHelpText}
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Precio de Venta *</label>
              <input type="number" class="form-input" id="productSellPrice" step="0.01" min="0" value="${product.sellPrice}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Precio de Compra</label>
              <input type="number" class="form-input" id="productCostPrice" step="0.01" min="0" value="${product.costPrice}" readonly>
              <small style="color: var(--muted-foreground);">Último precio de compra</small>
            </div>
          </div>
          ${imeiInputHtml}
          <div class="form-group">
            <label class="form-label">URL de Imagen</label>
            <input type="text" class="form-input" id="productImage" value="${product.image || ''}" placeholder="https://ejemplo.com/imagen.jpg">
          </div>
          <div class="form-group">
            <label class="form-label">Descripción</label>
            <textarea class="form-input" id="productDescription" rows="3" placeholder="Descripción del producto...">${product.description || ''}</textarea>
          </div>
        `;

        ui.showModal('Editar Producto', body, async () => {
          const productIMEIs = document.getElementById('productIMEIs') ? document.getElementById('productIMEIs').value.trim().split('\n').filter(line => line.length > 0) : [];
          const isCellularUpdated = document.getElementById('productCategory').value === 'Celulares';
          
          let updatedStock = product.stock;
          if (isCellularUpdated) {
            updatedStock = productIMEIs.length;
          } else {
            updatedStock = parseInt(document.getElementById('productStock').value) || 0;
          }

          const updated = {
            id: product.id, // Mantener el ID original de Firestore
            name: document.getElementById('productName').value.trim(),
            sku: document.getElementById('productSKU').value.trim(),
            category: document.getElementById('productCategory').value,
            stock: updatedStock,
            sellPrice: parseFloat(document.getElementById('productSellPrice').value) || 0,
            costPrice: product.costPrice, // Cost price is updated only on purchase
            avgCostPrice: product.avgCostPrice,
            image: document.getElementById('productImage').value.trim(),
            description: document.getElementById('productDescription').value.trim(),
            imeis: isCellularUpdated ? productIMEIs : [],
            createdAt: product.createdAt,
            updatedAt: new Date().toISOString()
          };

          if (!updated.name || !updated.sku) {
            ui.showToast('Nombre y SKU son obligatorios');
            return;
          }

          try {
            await storage.update('products', updated);
            ui.closeModal();
            ui.showToast('Producto actualizado exitosamente');
            this.loadProducts();
          } catch (error) {
            console.error("Error updating product:", error);
            ui.showToast('Error al actualizar producto.');
          }
        });

        // Add event listener to update stock based on IMEI count
        setTimeout(() => {
          const productCategorySelect = document.getElementById('productCategory');
          const productStockInput = document.getElementById('productStock');
          const productIMEIsTextarea = document.getElementById('productIMEIs');

          const updateStockFromIMEIs = () => {
            const isCellular = productCategorySelect.value === 'Celulares';
            if (isCellular && productIMEIsTextarea) {
              const imeiCount = productIMEIsTextarea.value.trim().split('\n').filter(line => line.length > 0).length;
              productStockInput.value = imeiCount;
              productStockInput.readOnly = true;
            } else {
              productStockInput.readOnly = false;
            }
          };

          if (productCategorySelect && productIMEIsTextarea) {
            productCategorySelect.addEventListener('change', updateStockFromIMEIs);
            productIMEIsTextarea.addEventListener('input', updateStockFromIMEIs);
          }
          updateStockFromIMEIs(); // Initial call
        }, 100);
      }

      async deleteProduct(id) {
        ui.confirmAction('¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.', async () => {
          try {
            await storage.delete('products', id);
            ui.showToast('Producto eliminado exitosamente');
            this.loadProducts();
          } catch (error) {
            console.error("Error deleting product:", error);
            ui.showToast('Error al eliminar producto.');
          }
        });
      }

      async importFromCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (event) => {
          const file = event.target.files[0];
          if (!file) return;

          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
              const productsToProcess = [];
              for (const row of results.data) {
                if (!row.name || !row.sku) continue;

                const isCellular = row.category === 'Celulares';
                const imeiList = row.imeis ? row.imeis.split(';').map(s => s.trim()).filter(s => s.length > 0) : [];
                let stock = parseInt(row.stock) || 0;
                if (isCellular && imeiList.length > 0) {
                  stock = imeiList.length;
                }

                productsToProcess.push({
                  name: row.name,
                  sku: row.sku,
                  category: row.category || 'Otros',
                  stock: stock,
                  sellPrice: parseFloat(row.sellPrice) || 0,
                  costPrice: parseFloat(row.costPrice) || 0,
                  avgCostPrice: parseFloat(row.costPrice) || 0,
                  image: row.image || '',
                  description: row.description || '',
                  imeis: isCellular ? imeiList : [],
                  createdAt: new Date().toISOString()
                });
              }

              try {
                const existingProducts = await storage.get('products');
                const updatedProductsMap = new Map(existingProducts.map(p => [p.sku, p]));

                for (const newProduct of productsToProcess) {
                  if (updatedProductsMap.has(newProduct.sku)) {
                    // Actualizar producto existente, manteniendo su ID de Firestore
                    const existingProduct = updatedProductsMap.get(newProduct.sku);
                    updatedProductsMap.set(newProduct.sku, { ...existingProduct, ...newProduct, id: existingProduct.id });
                  } else {
                    // Añadir nuevo producto (Firestore generará un nuevo ID)
                    updatedProductsMap.set(newProduct.sku, newProduct);
                  }
                }
                
                // Convertir el mapa de nuevo a un array para guardar
                const finalProducts = Array.from(updatedProductsMap.values());

                await storage.set('products', finalProducts); // Usar set para sobrescribir/actualizar
                ui.showToast(`Importados/Actualizados ${productsToProcess.length} productos exitosamente`);
                this.loadProducts();
              } catch (error) {
                console.error("Error importing products:", error);
                ui.showToast('Error al importar productos: ' + error.message);
              }
            },
            error: (error) => {
              ui.showToast('Error al leer CSV: ' + error.message);
            }
          });
        };
        input.click();
      }

      async exportToCSV() {
        const products = await storage.get('products');
        const productsToExport = products.map(p => ({
          ...p,
          imeis: p.imeis ? p.imeis.join(';') : '' // Join IMEIs with semicolon for CSV
        }));
        const csv = Papa.unparse(productsToExport);
        this.downloadFile(csv, 'productos.csv', 'text/csv');
      }

      downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }

    // ===== SALE MANAGER =====
    class SaleManager {
      async loadSales() {
        const sales = await storage.get('sales');
        const tableBody = document.querySelector('#salesTable tbody');
        tableBody.innerHTML = '';

        const filter = document.getElementById('searchSales').value.toLowerCase();

        const filtered = sales.filter(sale => 
          sale.customerName.toLowerCase().includes(filter) ||
          sale.items.some(item => item.productName.toLowerCase().includes(filter)) ||
          String(sale.id).includes(filter) || // Convertir ID a string para la búsqueda
          (sale.imeisSold && sale.imeisSold.some(imei => imei.toLowerCase().includes(filter.toLowerCase())))
        );

        // Sort by date (newest first)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(sale => {
          const tr = document.createElement('tr');
          let statusBadgeClass = '';
          let statusText = '';
          let statusIcon = '';

          if (sale.paymentStatus === 'paid') {
            statusBadgeClass = 'status-paid';
            statusText = 'Pagada';
            statusIcon = 'fas fa-check';
          } else if (sale.paymentStatus === 'pending') {
            statusBadgeClass = 'status-pending';
            statusText = 'Pendiente';
            statusIcon = 'fas fa-clock';
          } else if (sale.paymentStatus === 'credit') {
            statusBadgeClass = 'status-low-stock'; // Reusing for visual distinction
            statusText = 'Crédito';
            statusIcon = 'fas fa-credit-card';
          }

          tr.innerHTML = `
            <td>${new Date(sale.date).toLocaleDateString()}</td>
            <td><strong>${sale.customerName}</strong><br><small>${sale.customerPhone || ''}</small></td>
            <td><strong>${ui.formatCurrency(sale.total)}</strong></td>
            <td><span class="status-badge ${statusBadgeClass}"><i class="${statusIcon}"></i> ${statusText}</span></td>
            <td><span class="status-badge">${sale.paymentMethod}</span></td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline" data-action="view" data-id="${sale.id}" title="Ver detalles">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-sm btn-secondary" data-action="print" data-id="${sale.id}" title="Imprimir factura">
                <i class="fas fa-print"></i>
              </button>
              <button class="btn btn-sm btn-destructive" data-action="delete" data-id="${sale.id}" title="Eliminar venta">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async createSale() {
        let items = [];
        let products = await storage.get('products');
        let customers = await storage.get('customers');

        const renderItems = () => {
          const container = document.getElementById('saleItemsContainer');
          container.innerHTML = '';
          
          items.forEach((item, index) => {
            const product = products.find(p => String(p.id) === String(item.productId)); // Comparar IDs como strings
            if (!product) return;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'form-grid';
            itemDiv.style.marginBottom = '1rem';
            itemDiv.style.padding = '1rem';
            itemDiv.style.background = 'var(--muted)';
            itemDiv.style.borderRadius = 'var(--radius)';
            
            const isCellular = product.category === 'Celulares';
            // Filtrar IMEIs ya seleccionados por otros items en la misma venta
            const allSelectedImeisInSale = items.flatMap(i => i.imeisSold || []);
            const availableImeisForProduct = product.imeis.filter(imei => !allSelectedImeisInSale.includes(imei) || (item.imeisSold && item.imeisSold.includes(imei)));

            const imeiInput = isCellular ? `
              <div class="form-group">
                <label class="form-label">IMEI/Lote Vendido</label>
                <select class="form-select imei-select" data-product-id="${product.id}" multiple size="3">
                  <option value="">Seleccionar IMEI/Lote</option>
                  ${availableImeisForProduct.map(imei => `<option value="${imei}" ${item.imeisSold && item.imeisSold.includes(imei) ? 'selected' : ''}>${imei}</option>`).join('')}
                </select>
                <small style="color: var(--muted-foreground);">Selecciona el IMEI/Lote específico. (Mantén Ctrl/Cmd para múltiples)</small>
              </div>
            ` : '';

            itemDiv.innerHTML = `
              <div class="form-group">
                <label class="form-label">Producto</label>
                <div style="font-weight: 600;">${item.productName}</div>
                <small>Stock disponible: ${product.stock}</small>
              </div>
              <div class="form-group">
                <label class="form-label">Cantidad</label>
                <input type="number" class="form-input" value="${item.quantity}" min="1" max="${isCellular ? product.imeis.length : product.stock}" style="width: 100px;" ${isCellular ? 'readonly' : ''}>
              </div>
              <div class="form-group">
                <label class="form-label">Precio Unitario</label>
                <input type="number" class="form-input" value="${item.sellPrice}" step="0.01" min="0" style="width: 120px;">
              </div>
              <div class="form-group">
                <label class="form-label">Total</label>
                <div style="font-weight: 600; font-size: 1.1em;">${ui.formatCurrency(item.quantity * item.sellPrice)}</div>
                <button class="btn btn-sm btn-destructive" data-action="remove-item" data-index="${index}" style="margin-top: 0.5rem;">
                  <i class="fas fa-trash"></i> Eliminar
                </button>
              </div>
              ${imeiInput}
            `;
            
            container.appendChild(itemDiv);

            const qtyInput = itemDiv.querySelectorAll('input')[0];
            const priceInput = itemDiv.querySelectorAll('input')[1];
            const removeBtn = itemDiv.querySelector('[data-action="remove-item"]');
            const imeiSelect = itemDiv.querySelector('.imei-select');

            if (imeiSelect) {
              imeiSelect.addEventListener('change', (e) => {
                item.imeisSold = Array.from(e.target.selectedOptions).map(option => option.value);
                item.quantity = item.imeisSold.length; // Update quantity based on selected IMEIs
                qtyInput.value = item.quantity;
                renderItems(); // Re-render to update available IMEIs in other selects
                calculateTotals();
              });
            } else {
              qtyInput.addEventListener('change', (e) => {
                item.quantity = parseInt(e.target.value) || 1;
                if (item.quantity > product.stock) {
                  ui.showToast(`Cantidad excede el stock disponible (${product.stock})`);
                  item.quantity = product.stock;
                  e.target.value = item.quantity;
                }
                renderItems();
                calculateTotals();
              });
            }

            priceInput.addEventListener('change', (e) => {
              item.sellPrice = parseFloat(e.target.value) || 0;
              renderItems();
              calculateTotals();
            });

            removeBtn.addEventListener('click', () => {
              items.splice(index, 1); // Use splice with index for removal
              renderItems();
              calculateTotals();
            });
          });
        };

        const calculateTotals = () => {
          const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0);
          const taxRate = settingsManager.settings.taxRate || 19;
          const tax = subtotal * (taxRate / 100);
          const total = subtotal + tax;

          document.getElementById('saleSubtotal').textContent = ui.formatCurrency(subtotal);
          document.getElementById('saleTax').textContent = ui.formatCurrency(tax);
          document.getElementById('saleTotal').textContent = ui.formatCurrency(total);
        };

        const addProductToSale = () => {
          const select = document.getElementById('saleProductSelect');
          if (!select) return;
          const productId = select.value; // ID ahora es string
          const product = products.find(p => String(p.id) === String(productId));
          if (!product) {
            ui.showToast('Producto no encontrado');
            return;
          }
          if (product.stock <= 0 && product.category !== 'Celulares') { // For non-cellular, check stock directly
            ui.showToast('Stock insuficiente');
            return;
          }
          if (product.category === 'Celulares' && product.imeis.length === 0) { // For cellular, check if any IMEI is available
            ui.showToast('No hay IMEIs disponibles para este celular.');
            return;
          }

          const existing = items.find(i => String(i.productId) === String(productId));
          if (existing) {
            if (product.category === 'Celulares') {
              ui.showToast('Para celulares, agregue IMEIs individualmente.');
              return;
            }
            if (existing.quantity + 1 > product.stock) {
              ui.showToast('No hay suficiente stock');
              return;
            }
            existing.quantity += 1;
          } else {
            items.push({
              productId: product.id,
              productName: product.name,
              quantity: 1,
              sellPrice: product.sellPrice,
              imeisSold: product.category === 'Celulares' ? [] : [] // MODIFICACIÓN: Siempre un array vacío para no celulares
            });
          }

          renderItems();
          calculateTotals();
        };

        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Cliente</label>
              <select class="form-select" id="saleCustomerSelect">
                <option value="">Seleccionar cliente existente...</option>
                ${customers.map(c => `<option value="${c.id}">${c.name} - ${c.phone}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">O crear nuevo cliente</label>
              <input type="text" class="form-input" id="saleCustomerName" placeholder="Nombre del cliente">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-input" id="saleCustomerPhone" placeholder="Teléfono">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="saleCustomerEmail" placeholder="Email">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-input" id="saleCustomerAddress" placeholder="Dirección">
          </div>
          
          <hr style="margin: 1.5rem 0;">
          
          <div class="form-group">
            <label class="form-label">Agregar Producto</label>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <select class="form-select" id="saleProductSelect" style="flex: 1; min-width: 150px;">
                <option value="">Seleccionar producto...</option>
                ${products.filter(p => p.stock > 0 || (p.category === 'Celulares' && p.imeis.length > 0)).map(p => 
                  `<option value="${p.id}">${p.name} - ${ui.formatCurrency(p.sellPrice)} (${p.stock} disponibles)</option>`
                ).join('')}
              </select>
              <button type="button" class="btn btn-primary" id="btnAddSaleItem">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Productos en la venta</label>
            <div id="saleItemsContainer" style="max-height: 300px; overflow-y: auto;"></div>
          </div>
          
          <hr style="margin: 1.5rem 0;">
          
          <div style="background: var(--muted); padding: 1rem; border-radius: var(--radius);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Subtotal:</span>
              <strong id="saleSubtotal">$0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Impuesto:</span>
              <strong id="saleTax">$0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.2em; border-top: 1px solid var(--border); padding-top: 0.5rem;">
              <span><strong>Total:</strong></span>
              <strong id="saleTotal">$0</strong>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Estado de Pago</label>
              <select class="form-select" id="salePaymentStatus">
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
                <option value="credit">Crédito</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Método de Pago</label>
              <select class="form-select" id="salePaymentMethod">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div class="form-group" id="creditDueDateGroup" style="display:none;">
            <label class="form-label">Fecha de Vencimiento (Crédito)</label>
            <input type="date" class="form-input" id="creditDueDate">
          </div>
        `;

        ui.showModal('Nueva Venta', body, async () => {
          if (items.length === 0) {
            ui.showToast('Debe agregar al menos un producto');
            return;
          }

          // Validate IMEIs for cellular products
          for (const item of items) {
            const product = products.find(p => String(p.id) === String(item.productId));
            if (product && product.category === 'Celulares') {
              if (!item.imeisSold || item.imeisSold.length !== item.quantity) {
                ui.showToast(`Debe seleccionar ${item.quantity} IMEI(s)/Lote(s) para ${item.productName}`);
                return;
              }
            }
          }

          // Get customer info
          const selectedCustomerId = document.getElementById('saleCustomerSelect').value;
          let customerName = document.getElementById('saleCustomerName').value.trim();
          const customerPhone = document.getElementById('saleCustomerPhone').value.trim();
          const customerEmail = document.getElementById('saleCustomerEmail').value.trim();
          const customerAddress = document.getElementById('saleCustomerAddress').value.trim();

          let customerId = null;
          if (selectedCustomerId) {
            const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));
            if (selectedCustomer) {
              customerId = selectedCustomer.id;
              customerName = selectedCustomer.name;
            }
          }

          if (!customerName) {
            customerName = 'Consumidor Final';
          }

          const paymentStatus = document.getElementById('salePaymentStatus').value;
          const paymentMethod = document.getElementById('salePaymentMethod').value;
          const creditDueDate = paymentStatus === 'credit' ? document.getElementById('creditDueDate').value : null;

          const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0);
          const taxRate = settingsManager.settings.taxRate || 19;
          const tax = subtotal * (taxRate / 100);
          const total = subtotal + tax;

          const sale = {
            customerId, // Guardar el ID del cliente si existe
            customerName,
            customerPhone,
            customerEmail,
            customerAddress,
            date: new Date().toISOString().split('T')[0],
            items,
            imeisSold: items.flatMap(item => item.imeisSold || []), // Collect all sold IMEIs
            subtotal,
            taxRate,
            tax,
            discount: 0,
            total,
            paymentStatus,
            paymentMethod,
            creditDueDate,
            createdAt: new Date().toISOString()
          };

          try {
            const saleId = await storage.add('sales', sale);

            // Update product stock and remove sold IMEIs
            for (const item of items) {
              const product = products.find(p => String(p.id) === String(item.productId));
              if (product) {
                product.stock -= item.quantity;
                if (product.category === 'Celulares' && item.imeisSold) {
                  product.imeis = product.imeis.filter(imei => !item.imeisSold.includes(imei));
                }
                await storage.update('products', product);
              }
            }

            // Add/update customer and accounts receivable
            let customer = customers.find(c => String(c.id) === String(customerId) || (c.phone && c.phone === customerPhone));
            if (customer) {
              customer.totalPurchases = (customer.totalPurchases || 0) + total;
              customer.lastPurchase = new Date().toISOString();
              customer.email = customerEmail || customer.email;
              customer.address = customerAddress || customer.address;
              await storage.update('customers', customer);
            } else {
              const newCustomerId = await storage.add('customers', {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                address: customerAddress,
                totalPurchases: total,
                lastPurchase: new Date().toISOString(),
                createdAt: new Date().toISOString()
              });
              customer = { id: newCustomerId, name: customerName, phone: customerPhone, email: customerEmail, address: customerAddress };
            }

            if (paymentStatus === 'credit') {
              await storage.add('accountsReceivable', {
                saleId: saleId,
                customerId: customer.id,
                customerName: customer.name,
                amount: total,
                dueDate: creditDueDate,
                status: 'pending',
                createdAt: new Date().toISOString()
              });
            }

            ui.closeModal();
            ui.showToast('Venta registrada exitosamente');
            this.loadSales();
            
            // Auto-print invoice
            setTimeout(() => {
              this.printInvoice(saleId);
            }, 500);
          } catch (error) {
            console.error("Error creating sale:", error);
            ui.showToast('Error al registrar venta.');
          }
        });

        setTimeout(() => {
          document.getElementById('btnAddSaleItem').addEventListener('click', addProductToSale);
          
          // Customer select change handler
          document.getElementById('saleCustomerSelect').addEventListener('change', (e) => {
            if (e.target.value) {
              const customer = customers.find(c => String(c.id) === String(e.target.value));
              if (customer) {
                document.getElementById('saleCustomerName').value = customer.name;
                document.getElementById('saleCustomerPhone').value = customer.phone || '';
                document.getElementById('saleCustomerEmail').value = customer.email || '';
                document.getElementById('saleCustomerAddress').value = customer.address || '';
              }
            } else {
                // Clear fields if "Select existing customer" is chosen
                document.getElementById('saleCustomerName').value = '';
                document.getElementById('saleCustomerPhone').value = '';
                document.getElementById('saleCustomerEmail').value = '';
                document.getElementById('saleCustomerAddress').value = '';
            }
          });

          // Payment status change handler
          document.getElementById('salePaymentStatus').addEventListener('change', (e) => {
            const creditDueDateGroup = document.getElementById('creditDueDateGroup');
            if (e.target.value === 'credit') {
              creditDueDateGroup.style.display = 'flex';
            } else {
              creditDueDateGroup.style.display = 'none';
            }
          });
          
          renderItems();
          calculateTotals();
        }, 100);
      }

      async viewSale(id) {
        const sale = await storage.get('sales', id);
        if (!sale) return;

        let itemsHtml = `
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align:right;">Cant.</th>
                  <th style="text-align:right;">Precio</th>
                  <th style="text-align:right;">Total</th>
                  <th>IMEI/Lote</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        sale.items.forEach(item => {
          const total = item.quantity * item.sellPrice;
          const imeiDisplay = item.imeisSold && item.imeisSold.length > 0 ? item.imeisSold.join(', ') : 'N/A';
          itemsHtml += `
            <tr>
              <td>${item.productName}</td>
              <td style="text-align:right;">${item.quantity}</td>
              <td style="text-align:right;">${ui.formatCurrency(item.sellPrice)}</td>
              <td style="text-align:right;">${ui.formatCurrency(total)}</td>
              <td>${imeiDisplay}</td>
            </tr>
          `;
        });
        
        itemsHtml += `
              </tbody>
            </table>
          </div>
          <div style="background: var(--muted); padding: 1rem; border-radius: var(--radius); margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Subtotal:</span>
              <strong>${ui.formatCurrency(sale.subtotal)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Impuesto (${sale.taxRate}%):</span>
              <strong>${ui.formatCurrency(sale.tax)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.2em; border-top: 1px solid var(--border); padding-top: 0.5rem;">
              <span><strong>TOTAL:</strong></span>
              <strong>${ui.formatCurrency(sale.total)}</strong>
            </div>
          </div>
        `;

        let statusBadgeClass = '';
        let statusText = '';
        let statusIcon = '';

        if (sale.paymentStatus === 'paid') {
          statusBadgeClass = 'status-paid';
          statusText = 'Pagada';
          statusIcon = 'fas fa-check';
        } else if (sale.paymentStatus === 'pending') {
          statusBadgeClass = 'status-pending';
          statusText = 'Pendiente';
          statusIcon = 'fas fa-clock';
        } else if (sale.paymentStatus === 'credit') {
          statusBadgeClass = 'status-low-stock';
          statusText = 'Crédito';
          statusIcon = 'fas fa-credit-card';
        }

        const body = `
          <div class="form-grid">
            <div>
              <h4>Información del Cliente</h4>
              <p><strong>Nombre:</strong> ${sale.customerName}</p>
              <p><strong>Teléfono:</strong> ${sale.customerPhone || 'N/A'}</p>
              <p><strong>Email:</strong> ${sale.customerEmail || 'N/A'}</p>
              <p><strong>Dirección:</strong> ${sale.customerAddress || 'N/A'}</p>
            </div>
            <div>
              <h4>Información de la Venta</h4>
              <p><strong>Fecha:</strong> ${new Date(sale.date).toLocaleDateString()}</p>
              <p><strong>Estado:</strong> <span class="status-badge ${statusBadgeClass}"><i class="${statusIcon}"></i> ${statusText}</span></p>
              <p><strong>Método de Pago:</strong> <span class="status-badge">${sale.paymentMethod}</span></p>
              ${sale.creditDueDate ? `<p><strong>Vencimiento Crédito:</strong> ${new Date(sale.creditDueDate).toLocaleDateString()}</p>` : ''}
              <p><strong>Factura No.:</strong> ${sale.id}</p>
            </div>
          </div>
          <h4 style="margin-top: 1.5rem;">Productos</h4>
          ${itemsHtml}
        `;

        ui.showModal('Detalle de Venta #' + sale.id, body, () => ui.closeModal(), false); // No save button for view
      }

      async deleteSale(id) {
        ui.confirmAction('¿Está seguro de eliminar esta venta? Esta acción no se puede deshacer y el stock NO será restaurado automáticamente.', async () => {
          try {
            const saleToDelete = await storage.get('sales', id);
            if (!saleToDelete) {
              ui.showToast('Venta no encontrada.');
              return;
            }

            // 1. Descontar el valor de la venta del total de compras del cliente
            if (saleToDelete.customerId) {
              const customer = await storage.get('customers', saleToDelete.customerId);
              if (customer) {
                customer.totalPurchases = (customer.totalPurchases || 0) - saleToDelete.total;
                if (customer.totalPurchases < 0) customer.totalPurchases = 0; // Evitar valores negativos
                await storage.update('customers', customer);
                console.log(`Total de compras del cliente ${customer.name} actualizado a ${customer.totalPurchases}`);
              }
            }

            // 2. Eliminar de cuentas por cobrar si fue una venta a crédito
            const ar = await storage.get('accountsReceivable');
            const filteredAr = ar.filter(item => String(item.saleId) !== String(id));
            await storage.set('accountsReceivable', filteredAr);

            // 3. Eliminar la venta
            await storage.delete('sales', id);
            
            ui.showToast('Venta eliminada exitosamente y total de compras del cliente actualizado.');
            this.loadSales();
            customerManager.loadCustomers(); // Recargar la tabla de clientes para reflejar el cambio
          } catch (error) {
            console.error("Error deleting sale:", error);
            ui.showToast('Error al eliminar venta.');
          }
        });
      }

      async printInvoice(saleId) {
        const sale = await storage.get('sales', saleId);
        if (!sale) return;
        
        const settings = settingsManager.settings;

        document.getElementById('invoiceLogo').src = settings.logoURL;
        document.getElementById('invoiceNumber').textContent = String(saleId).padStart(6, '0'); // Convertir a string
        document.getElementById('invoiceDate').textContent = new Date(sale.date).toLocaleDateString();
        document.getElementById('invoiceClientName').textContent = sale.customerName;
        document.getElementById('invoiceClientPhone').textContent = sale.customerPhone || 'N/A';
        document.getElementById('invoiceTaxRate').textContent = settings.taxRate; // Usar el taxRate de la configuración
        document.getElementById('invoiceSubtotal').textContent = ui.formatCurrency(sale.subtotal);
        document.getElementById('invoiceTax').textContent = ui.formatCurrency(sale.tax);
        document.getElementById('invoiceTotal').textContent = ui.formatCurrency(sale.total);
        document.getElementById('invoiceCompanyInfo').innerHTML = `
          <strong>${settings.companyName}</strong><br>
          NIT: ${settings.companyNIT}<br>
          ${settings.companyAddress ? `Dirección: ${settings.companyAddress}` : ''}
        `;

        const itemsBody = document.getElementById('invoiceItems').getElementsByTagName('tbody')[0];
        itemsBody.innerHTML = '';
        sale.items.forEach(item => {
          const tr = document.createElement('tr');
          const imeiInfo = item.imeisSold && item.imeisSold.length > 0 ? `<br><small>IMEI/Lote: ${item.imeisSold.join(', ')}</small>` : '';
          tr.innerHTML = `
            <td>${item.productName}${imeiInfo}</td>
            <td style="text-align:right;">${item.quantity}</td>
            <td style="text-align:right;">${ui.formatCurrency(item.sellPrice)}</td>
            <td style="text-align:right;">${ui.formatCurrency(item.quantity * item.sellPrice)}</td>
          `;
          itemsBody.appendChild(tr);
        });

        // Use html2canvas and jsPDF for better PDF generation
        const invoiceElement = document.getElementById('invoice');
        invoiceElement.style.display = 'block'; // Make visible for rendering

        html2canvas(invoiceElement, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new window.jspdf.jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            pdf.save(`factura-${saleId}.pdf`);
            invoiceElement.style.display = 'none'; // Hide after rendering
        }).catch(error => {
            console.error("Error generating PDF:", error);
            ui.showToast("Error al generar PDF. Intenta de nuevo.");
            invoiceElement.style.display = 'none'; // Hide even on error
        });
      }
    }

    // ===== CUSTOMER MANAGER =====
    class CustomerManager {
      async loadCustomers() {
        const customers = await storage.get('customers');
        const tableBody = document.querySelector('#customersTable tbody');
        tableBody.innerHTML = '';

        const filter = document.getElementById('searchCustomers').value.toLowerCase();

        const filtered = customers.filter(customer => 
          customer.name.toLowerCase().includes(filter) ||
          (customer.phone && customer.phone.toLowerCase().includes(filter)) ||
          (customer.email && customer.email.toLowerCase().includes(filter))
        );

        filtered.forEach(customer => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone || 'N/A'}</td>
            <td>${customer.email || 'N/A'}</td>
            <td><strong>${ui.formatCurrency(customer.totalPurchases || 0)}</strong></td>
            <td>${customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString() : 'N/A'}</td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${customer.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-destructive" data-action="delete" data-id="${customer.id}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async addCustomer() {
        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-input" id="customerName" required>
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-input" id="customerPhone">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="customerEmail">
            </div>
            <div class="form-group">
              <label class="form-label">Documento</label>
              <input type="text" class="form-input" id="customerDocument">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-input" id="customerAddress">
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-input" id="customerNotes" rows="3"></textarea>
          </div>
        `;

        ui.showModal('Nuevo Cliente', body, async () => {
          const customer = {
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            document: document.getElementById('customerDocument').value.trim(),
            address: document.getElementById('customerAddress').value.trim(),
            notes: document.getElementById('customerNotes').value.trim(),
            totalPurchases: 0,
            createdAt: new Date().toISOString()
          };

          if (!customer.name) {
            ui.showToast('El nombre es obligatorio');
            return;
          }

          try {
            await storage.add('customers', customer);
            ui.closeModal();
            ui.showToast('Cliente agregado exitosamente');
            this.loadCustomers();
          } catch (error) {
            console.error("Error adding customer:", error);
            ui.showToast('Error al agregar cliente.');
          }
        });
      }

      async editCustomer(id) {
        const customer = await storage.get('customers', id);
        if (!customer) return;

        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-input" id="customerName" value="${customer.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-input" id="customerPhone" value="${customer.phone || ''}">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="customerEmail" value="${customer.email || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Documento</label>
              <input type="text" class="form-input" id="customerDocument" value="${customer.document || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-input" id="customerAddress" value="${customer.address || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-input" id="customerNotes" rows="3">${customer.notes || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Total de Compras</label>
            <input type="text" class="form-input" value="${ui.formatCurrency(customer.totalPurchases || 0)}" readonly>
          </div>
        `;

        ui.showModal('Editar Cliente', body, async () => {
          const updated = {
            id: customer.id, // Mantener el ID original de Firestore
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            document: document.getElementById('customerDocument').value.trim(),
            address: document.getElementById('customerAddress').value.trim(),
            notes: document.getElementById('customerNotes').value.trim(),
            totalPurchases: customer.totalPurchases,
            lastPurchase: customer.lastPurchase,
            createdAt: customer.createdAt,
            updatedAt: new Date().toISOString()
          };

          if (!updated.name) {
            ui.showToast('El nombre es obligatorio');
            return;
          }

          try {
            await storage.update('customers', updated);
            ui.closeModal();
            ui.showToast('Cliente actualizado exitosamente');
            this.loadCustomers();
          } catch (error) {
            console.error("Error updating customer:", error);
            ui.showToast('Error al actualizar cliente.');
          }
        });
      }

      async deleteCustomer(id) {
        ui.confirmAction('¿Está seguro de eliminar este cliente?', async () => {
          try {
            await storage.delete('customers', id);
            ui.showToast('Cliente eliminado exitosamente');
            this.loadCustomers();
          } catch (error) {
            console.error("Error deleting customer:", error);
            ui.showToast('Error al eliminar cliente.');
          }
        });
      }
    }

    // ===== SUPPLIER MANAGER =====
    class SupplierManager {
      async loadSuppliers() {
        const suppliers = await storage.get('suppliers');
        const tableBody = document.querySelector('#suppliersTable tbody');
        tableBody.innerHTML = '';

        suppliers.forEach(supplier => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${supplier.name}</strong></td>
            <td><code>${supplier.nit}</code></td>
            <td>${supplier.contact || 'N/A'}</td>
            <td>${supplier.phone || 'N/A'}</td>
            <td>${supplier.email || 'N/A'}</td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${supplier.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-destructive" data-action="delete" data-id="${supplier.id}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async addSupplier() {
        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-input" id="supplierName" required>
            </div>
            <div class="form-group">
              <label class="form-label">NIT / ID *</label>
              <input type="text" class="form-input" id="supplierNIT" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Contacto</label>
              <input type="text" class="form-input" id="supplierContact">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-input" id="supplierPhone">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="supplierEmail">
            </div>
            <div class="form-group">
              <label class="form-label">Sitio Web</label>
              <input type="text" class="form-input" id="supplierWebsite">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-input" id="supplierAddress">
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-input" id="supplierNotes" rows="3"></textarea>
          </div>
        `;

        ui.showModal('Nuevo Proveedor', body, async () => {
          const supplier = {
            name: document.getElementById('supplierName').value.trim(),
            nit: document.getElementById('supplierNIT').value.trim(),
            contact: document.getElementById('supplierContact').value.trim(),
            phone: document.getElementById('supplierPhone').value.trim(),
            email: document.getElementById('supplierEmail').value.trim(),
            website: document.getElementById('supplierWebsite').value.trim(),
            address: document.getElementById('supplierAddress').value.trim(),
            notes: document.getElementById('supplierNotes').value.trim(),
            createdAt: new Date().toISOString()
          };

          if (!supplier.name || !supplier.nit) {
            ui.showToast('Nombre y NIT son obligatorios');
            return;
          }

          try {
            await storage.add('suppliers', supplier);
            ui.closeModal();
            ui.showToast('Proveedor agregado exitosamente');
            this.loadSuppliers();
          } catch (error) {
            console.error("Error adding supplier:", error);
            ui.showToast('Error al agregar proveedor.');
          }
        });
      }

      async editSupplier(id) {
        const supplier = await storage.get('suppliers', id);
        if (!supplier) return;

        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-input" id="supplierName" value="${supplier.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">NIT / ID *</label>
              <input type="text" class="form-input" id="supplierNIT" value="${supplier.nit}" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Contacto</label>
              <input type="text" class="form-input" id="supplierContact" value="${supplier.contact || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-input" id="supplierPhone" value="${supplier.phone || ''}">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="supplierEmail" value="${supplier.email || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Sitio Web</label>
              <input type="text" class="form-input" id="supplierWebsite" value="${supplier.website || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-input" id="supplierAddress" value="${supplier.address || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-input" id="supplierNotes" rows="3">${supplier.notes || ''}</textarea>
          </div>
        `;

        ui.showModal('Editar Proveedor', body, async () => {
          const updated = {
            id: supplier.id, // Mantener el ID original de Firestore
            name: document.getElementById('supplierName').value.trim(),
            nit: document.getElementById('supplierNIT').value.trim(),
            contact: document.getElementById('supplierContact').value.trim(),
            phone: document.getElementById('supplierPhone').value.trim(),
            email: document.getElementById('supplierEmail').value.trim(),
            website: document.getElementById('supplierWebsite').value.trim(),
            address: document.getElementById('supplierAddress').value.trim(),
            notes: document.getElementById('supplierNotes').value.trim(),
            createdAt: supplier.createdAt,
            updatedAt: new Date().toISOString()
          };

          if (!updated.name || !updated.nit) {
            ui.showToast('Nombre y NIT son obligatorios');
            return;
          }

          try {
            await storage.update('suppliers', updated);
            ui.closeModal();
            ui.showToast('Proveedor actualizado exitosamente');
            this.loadSuppliers();
          } catch (error) {
            console.error("Error updating supplier:", error);
            ui.showToast('Error al actualizar proveedor.');
          }
        });
      }

      async deleteSupplier(id) {
        ui.confirmAction('¿Está seguro de eliminar este proveedor?', async () => {
          try {
            await storage.delete('suppliers', id);
            ui.showToast('Proveedor eliminado exitosamente');
            this.loadSuppliers();
          } catch (error) {
            console.error("Error deleting supplier:", error);
            ui.showToast('Error al eliminar proveedor.');
          }
        });
      }
    }

    // ===== PURCHASE MANAGER =====
    class PurchaseManager {
      async loadPurchases() {
        const purchases = await storage.get('purchases');
        const suppliers = await storage.get('suppliers');
        const tableBody = document.querySelector('#purchasesTable tbody');
        tableBody.innerHTML = '';

        const dateFilter = document.getElementById('filterPurchaseDate').value;
        const supplierFilter = document.getElementById('filterPurchaseSupplier').value;

        let filtered = purchases;

        if (dateFilter) {
          filtered = filtered.filter(p => p.date.startsWith(dateFilter));
        }
        if (supplierFilter) {
          filtered = filtered.filter(p => String(p.supplierId) === String(supplierFilter)); // Comparar IDs como strings
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(purchase => {
          const supplier = suppliers.find(s => String(s.id) === String(purchase.supplierId)); // Comparar IDs como strings
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${new Date(purchase.date).toLocaleDateString()}</td>
            <td><strong>${supplier ? supplier.name : 'Proveedor eliminado'}</strong></td>
            <td><strong>${ui.formatCurrency(purchase.total)}</strong></td>
            <td><span class="status-badge">${purchase.items.length} productos</span></td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline" data-action="view" data-id="${purchase.id}">
                <i class="fas fa-eye"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async addPurchase() {
        const suppliers = await storage.get('suppliers');
        if (suppliers.length === 0) {
          ui.showToast('Primero debe registrar al menos un proveedor');
          return;
        }

        let items = [];
        let products = await storage.get('products');

        const renderItems = () => {
          const container = document.getElementById('purchaseItemsContainer');
          container.innerHTML = '';
          
          items.forEach((item, index) => {
            const product = products.find(p => String(p.id) === String(item.productId)); // Comparar IDs como strings
            const isCellular = product && product.category === 'Celulares';
            const imeiInput = isCellular ? `
              <div class="form-group">
                <label class="form-label">IMEIs / Lotes (uno por línea)</label>
                <textarea class="form-input" rows="2" placeholder="IMEI1&#10;IMEI2">${item.imeis ? item.imeis.join('\n') : ''}</textarea>
                <small style="color: var(--muted-foreground);">El stock se ajustará automáticamente por la cantidad de IMEIs/Lotes ingresados.</small>
              </div>
            ` : '';

            const qtyReadonly = isCellular ? 'readonly' : '';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'form-grid';
            itemDiv.style.marginBottom = '1rem';
            itemDiv.style.padding = '1rem';
            itemDiv.style.background = 'var(--muted)';
            itemDiv.style.borderRadius = 'var(--radius)';
            
            itemDiv.innerHTML = `
              <div class="form-group">
                <label class="form-label">Producto</label>
                <select class="form-select" data-action="select-product" data-index="${index}">
                  ${products.map(p => `<option value="${p.id}" ${String(p.id) === String(item.productId) ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Cantidad</label>
                <input type="number" class="form-input" value="${item.quantity}" min="1" style="width: 100px;" ${qtyReadonly} data-action="update-qty" data-index="${index}">
              </div>
              <div class="form-group">
                <label class="form-label">Precio Unitario</label>
                <input type="number" class="form-input" value="${item.costPrice}" step="0.01" min="0" style="width: 120px;" data-action="update-price" data-index="${index}">
              </div>
              <div class="form-group">
                <label class="form-label">Total</label>
                <div style="font-weight: 600; font-size: 1.1em;">${ui.formatCurrency(item.quantity * item.costPrice)}</div>
                <button class="btn btn-sm btn-destructive" data-action="remove-item" data-index="${index}" style="margin-top: 0.5rem;">
                  <i class="fas fa-trash"></i> Eliminar
                </button>
              </div>
              ${imeiInput}
            `;
            
            container.appendChild(itemDiv);

            // Attach event listeners directly to the newly created elements
            const select = itemDiv.querySelector('[data-action="select-product"]');
            const qtyInput = itemDiv.querySelector('[data-action="update-qty"]');
            const priceInput = itemDiv.querySelector('[data-action="update-price"]');
            const removeBtn = itemDiv.querySelector('[data-action="remove-item"]');
            const imeiTextarea = itemDiv.querySelector('textarea');

            select.addEventListener('change', () => {
              item.productId = select.value; // ID ahora es string
              const selectedProduct = products.find(p => String(p.id) === String(item.productId));
              if (selectedProduct && selectedProduct.category === 'Celulares') {
                item.imeis = []; // Clear IMEIs if changing to cellular
                qtyInput.readOnly = true;
                qtyInput.value = 0;
              } else {
                item.imeis = undefined; // Remove IMEIs if not cellular
                qtyInput.readOnly = false;
              }
              renderItems(); // Re-render to update IMEI input visibility
              updateTotal();
            });

            if (imeiTextarea) {
              imeiTextarea.addEventListener('input', () => {
                item.imeis = imeiTextarea.value.trim().split('\n').filter(line => line.length > 0);
                item.quantity = item.imeis.length;
                qtyInput.value = item.quantity;
                updateTotal();
              });
            } else {
              qtyInput.addEventListener('change', () => {
                item.quantity = parseInt(qtyInput.value) || 1;
                renderItems();
                updateTotal();
              });
            }

            priceInput.addEventListener('change', () => {
              item.costPrice = parseFloat(priceInput.value) || 0;
              renderItems();
              updateTotal();
            });

            removeBtn.addEventListener('click', () => {
              items.splice(index, 1);
              renderItems();
              updateTotal();
            });
          });
        };

        const updateTotal = () => {
          const total = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
          const elem = document.getElementById('purchaseTotal');
          if (elem) elem.textContent = ui.formatCurrency(total);
        };

        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Proveedor *</label>
              <select class="form-select" id="purchaseSupplier">
                ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="date" class="form-input" id="purchaseDate" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Productos</label>
            <div id="purchaseItemsContainer" style="max-height: 400px; overflow-y: auto;"></div>
            <button type="button" class="btn btn-outline" id="btnAddPurchaseItem">
              <i class="fas fa-plus"></i> Agregar Producto
            </button>
          </div>
          
          <div class="form-group">
            <label class="form-label">Nota (opcional)</label>
            <textarea class="form-input" id="purchaseNote" rows="2"></textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Estado de Pago</label>
              <select class="form-select" id="purchasePaymentStatus">
                <option value="paid">Pagada</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
            <div class="form-group" id="purchaseDueDateGroup" style="display:none;">
              <label class="form-label">Fecha de Vencimiento (Pendiente)</label>
              <input type="date" class="form-input" id="purchaseDueDate">
            </div>
          </div>
          
          <div style="background: var(--muted); padding: 1rem; border-radius: var(--radius);">
            <div style="display: flex; justify-content: space-between; font-size: 1.2em;">
              <span><strong>Total:</strong></span>
              <strong id="purchaseTotal">$0</strong>
            </div>
          </div>
        `;

        ui.showModal('Nueva Compra', body, async () => {
          if (items.length === 0) {
            ui.showToast('Debe agregar al menos un producto');
            return;
          }

          // Validate IMEIs for cellular products
          for (const item of items) {
            const product = products.find(p => String(p.id) === String(item.productId));
            if (product && product.category === 'Celulares') {
              if (!item.imeis || item.imeis.length !== item.quantity) {
                ui.showToast(`Debe ingresar ${item.quantity} IMEI(s)/Lote(s) para ${product.name}`);
                return;
              }
            }
          }

          const supplierId = document.getElementById('purchaseSupplier').value; // ID ahora es string
          const date = document.getElementById('purchaseDate').value;
          const note = document.getElementById('purchaseNote').value;
          const paymentStatus = document.getElementById('purchasePaymentStatus').value;
          const dueDate = paymentStatus === 'pending' ? document.getElementById('purchaseDueDate').value : null;

          const total = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);

          const purchase = {
            supplierId,
            date,
            items,
            total,
            note,
            paymentStatus,
            dueDate,
            createdAt: new Date().toISOString()
          };

          try {
            const purchaseId = await storage.add('purchases', purchase);

            // Update product stock and costs
            for (const item of items) {
              const product = products.find(p => String(p.id) === String(item.productId));
              if (product) {
                const currentStock = product.stock || 0;
                const currentTotalCost = (product.avgCostPrice || 0) * currentStock;
                
                const newStock = currentStock + item.quantity;
                const newTotalCost = currentTotalCost + (item.costPrice * item.quantity);
                const newAvgCost = newStock > 0 ? newTotalCost / newStock : 0; // Avoid division by zero

                product.stock = newStock;
                product.costPrice = item.costPrice; // Last purchase price
                product.avgCostPrice = newAvgCost;
                if (product.category === 'Celulares' && item.imeis) {
                  product.imeis = [...(product.imeis || []), ...item.imeis]; // Ensure product.imeis is an array
                }

                await storage.update('products', product);
              }
            }

            // Add to accounts payable if pending
            if (paymentStatus === 'pending') {
              const supplier = suppliers.find(s => String(s.id) === String(supplierId));
              await storage.add('accountsPayable', {
                purchaseId: purchaseId,
                supplierId: supplierId,
                supplierName: supplier ? supplier.name : 'N/A',
                amount: total,
                dueDate: dueDate,
                status: 'pending',
                createdAt: new Date().toISOString()
              });
            }

            ui.closeModal();
            ui.showToast('Compra registrada y stock actualizado');
            this.loadPurchases();
          } catch (error) {
            console.error("Error al registrar compra:", error); // Log the actual error
            ui.showToast('Error al registrar compra. Revisa la consola para más detalles.');
          }
        });

        setTimeout(() => {
          document.getElementById('btnAddPurchaseItem').addEventListener('click', () => {
            if (products.length === 0) {
              ui.showToast('No hay productos registrados');
              return;
            }
            // Find the first product that is not cellular or has IMEIs
            const defaultProduct = products.find(p => p.category !== 'Celulares' || (p.category === 'Celulares' && p.imeis.length > 0));
            if (!defaultProduct) {
                ui.showToast('No hay productos válidos para agregar.');
                return;
            }
            items.push({ productId: defaultProduct.id, quantity: 1, costPrice: defaultProduct.costPrice || 0, imeis: defaultProduct.category === 'Celulares' ? [] : undefined });
            renderItems();
            updateTotal();
          });

          document.getElementById('purchasePaymentStatus').addEventListener('change', (e) => {
            const purchaseDueDateGroup = document.getElementById('purchaseDueDateGroup');
            if (e.target.value === 'pending') {
              purchaseDueDateGroup.style.display = 'flex';
            } else {
              purchaseDueDateGroup.style.display = 'none';
            }
          });

          renderItems();
          updateTotal();
        }, 100);
      }

      async viewPurchase(id) {
        const purchase = await storage.get('purchases', id);
        if (!purchase) return; // Ensure purchase exists
        
        const supplier = await storage.get('suppliers', purchase.supplierId);
        const products = await storage.get('products');

        let itemsHtml = `
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align:right;">Cant.</th>
                  <th style="text-align:right;">Precio</th>
                  <th style="text-align:right;">Total</th>
                  <th>IMEI/Lote</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        purchase.items.forEach(item => {
          const product = products.find(p => String(p.id) === String(item.productId));
          const name = product ? product.name : 'Producto eliminado';
          const total = item.quantity * item.costPrice;
          const imeiDisplay = item.imeis && item.imeis.length > 0 ? item.imeis.join(', ') : 'N/A';
          itemsHtml += `
            <tr>
              <td>${name}</td>
              <td style="text-align:right;">${item.quantity}</td>
              <td style="text-align:right;">${ui.formatCurrency(item.costPrice)}</td>
              <td style="text-align:right;">${ui.formatCurrency(total)}</td>
              <td>${imeiDisplay}</td>
            </tr>
          `;
        });
        
        itemsHtml += `
              </tbody>
            </table>
          </div>
          <div style="background: var(--muted); padding: 1rem; border-radius: var(--radius); margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 1.2em;">
              <span><strong>Total:</strong></span>
              <strong id="purchaseTotal">${ui.formatCurrency(purchase.total)}</strong>
            </div>
          </div>
        `;

        const statusBadge = purchase.paymentStatus === 'paid' ? 
          `<span class="status-badge status-paid"><i class="fas fa-check"></i> Pagada</span>` :
          `<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pendiente</span>`;

        const body = `
          <div class="form-grid">
            <div>
              <h4>Información del Proveedor</h4>
              <p><strong>Nombre:</strong> ${supplier ? supplier.name : 'Proveedor eliminado'}</p>
              <p><strong>NIT:</strong> ${supplier ? supplier.nit : 'N/A'}</p>
              <p><strong>Contacto:</strong> ${supplier ? supplier.contact || 'N/A' : 'N/A'}</p>
            </div>
            <div>
              <h4>Información de la Compra</h4>
              <p><strong>Fecha:</strong> ${new Date(purchase.date).toLocaleDateString()}</p>
              <p><strong>Estado de Pago:</strong> ${statusBadge}</p>
              ${purchase.dueDate ? `<p><strong>Fecha Vencimiento:</strong> ${new Date(purchase.dueDate).toLocaleDateString()}</p>` : ''}
              <p><strong>Nota:</strong> ${purchase.note || 'N/A'}</p>
            </div>
          </div>
          <h4 style="margin-top: 1.5rem;">Productos</h4>
          ${itemsHtml}
        `;

        ui.showModal('Detalle de Compra', body, () => ui.closeModal(), false);
      }

      async loadSuppliersForFilter() {
        const suppliers = await storage.get('suppliers');
        const select = document.getElementById('filterPurchaseSupplier');
        select.innerHTML = '<option value="">Todos los proveedores</option>';
        suppliers.forEach(s => {
          const option = document.createElement('option');
          option.value = s.id;
          option.textContent = s.name;
          select.appendChild(option);
        });
        select.onchange = () => this.loadPurchases();
      }
    }

    // ===== EXPENSE MANAGER =====
    class ExpenseManager {
      async loadExpenses() {
        const expenses = await storage.get('expenses');
        const tableBody = document.querySelector('#expensesTable tbody');
        tableBody.innerHTML = '';

        const dateFilter = document.getElementById('filterExpenseDate').value;
        const categoryFilter = document.getElementById('filterExpenseCategory').value;

        let filtered = expenses;

        if (dateFilter) {
          filtered = filtered.filter(e => e.date.startsWith(dateFilter));
        }
        if (categoryFilter) {
          filtered = filtered.filter(e => e.category === categoryFilter);
        }

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(expense => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${new Date(expense.date).toLocaleDateString()}</td>
            <td><strong>${expense.concept}</strong><br><small>${expense.description || ''}</small></td>
            <td><span class="status-badge">${expense.category}</span></td>
            <td><strong>${ui.formatCurrency(expense.amount)}</strong></td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${expense.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-destructive" data-action="delete" data-id="${expense.id}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async addExpense() {
        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Concepto *</label>
              <input type="text" class="form-input" id="expenseConcept" required>
            </div>
            <div class="form-group">
              <label class="form-label">Monto *</label>
              <input type="number" class="form-input" id="expenseAmount" step="0.01" min="0" value="0" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Categoría</label>
              <select class="form-select" id="expenseCategory">
                <option value="Arriendo">Arriendo</option>
                <option value="Servicios">Servicios</option>
                <option value="Sueldos">Sueldos</option>
                <option value="Publicidad">Publicidad</option>
                <option value="Transporte">Transporte</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="date" class="form-input" id="expenseDate" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción (opcional)</label>
            <textarea class="form-input" id="expenseDescription" rows="3"></textarea>
          </div>
        `;

        ui.showModal('Nuevo Gasto', body, async () => {
          const expense = {
            concept: document.getElementById('expenseConcept').value.trim(),
            amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
            category: document.getElementById('expenseCategory').value,
            date: document.getElementById('expenseDate').value,
            description: document.getElementById('expenseDescription').value.trim(),
            createdAt: new Date().toISOString()
          };

          if (!expense.concept || expense.amount <= 0) {
            ui.showToast('Concepto y monto válido son obligatorios');
            return;
          }

          try {
            await storage.add('expenses', expense);
            ui.closeModal();
            ui.showToast('Gasto agregado exitosamente');
            this.loadExpenses();
          } catch (error) {
            console.error("Error adding expense:", error);
            ui.showToast('Error al agregar gasto.');
          }
        });
      }

      async editExpense(id) {
        const expense = await storage.get('expenses', id);
        if (!expense) return;

        const body = `
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Concepto *</label>
              <input type="text" class="form-input" id="expenseConcept" value="${expense.concept}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Monto *</label>
              <input type="number" class="form-input" id="expenseAmount" step="0.01" min="0" value="${expense.amount}" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Categoría</label>
              <select class="form-select" id="expenseCategory">
                <option value="Arriendo" ${expense.category === 'Arriendo' ? 'selected' : ''}>Arriendo</option>
                <option value="Servicios" ${expense.category === 'Servicios' ? 'selected' : ''}>Servicios</option>
                <option value="Sueldos" ${expense.category === 'Sueldos' ? 'selected' : ''}>Sueldos</option>
                <option value="Publicidad" ${expense.category === 'Publicidad' ? 'selected' : ''}>Publicidad</option>
                <option value="Transporte" ${expense.category === 'Transporte' ? 'selected' : ''}>Transporte</option>
                <option value="Mantenimiento" ${expense.category === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
                <option value="Otros" ${expense.category === 'Otros' ? 'selected' : ''}>Otros</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="date" class="form-input" id="expenseDate" value="${expense.date}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción (opcional)</label>
            <textarea class="form-input" id="expenseDescription" rows="3">${expense.description || ''}</textarea>
          </div>
        `;

        ui.showModal('Editar Gasto', body, async () => {
          const updated = {
            id: expense.id, // Mantener el ID original de Firestore
            concept: document.getElementById('expenseConcept').value.trim(),
            amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
            category: document.getElementById('expenseCategory').value,
            date: document.getElementById('expenseDate').value,
            description: document.getElementById('expenseDescription').value.trim(),
            createdAt: expense.createdAt,
            updatedAt: new Date().toISOString()
          };

          if (!updated.concept || updated.amount <= 0) {
            ui.showToast('Concepto y monto válido son obligatorios');
            return;
          }

          try {
            await storage.update('expenses', updated);
            ui.closeModal();
            ui.showToast('Gasto actualizado exitosamente');
            this.loadExpenses();
          } catch (error) {
            console.error("Error updating expense:", error);
            ui.showToast('Error al actualizar gasto.');
          }
        });
      }

      async deleteExpense(id) {
        ui.confirmAction('¿Está seguro de eliminar este gasto?', async () => {
          try {
            await storage.delete('expenses', id);
            ui.showToast('Gasto eliminado exitosamente');
            this.loadExpenses();
          } catch (error) {
            console.error("Error deleting expense:", error);
            ui.showToast('Error al eliminar gasto.');
          }
        });
      }
    }

    // ===== ACCOUNTS RECEIVABLE MANAGER =====
    class AccountsReceivableManager {
      async loadAccountsReceivable() {
        const accounts = await storage.get('accountsReceivable');
        const customers = await storage.get('customers');
        const tableBody = document.querySelector('#accountsReceivableTable tbody');
        tableBody.innerHTML = '';

        const filtered = accounts.filter(acc => acc.status === 'pending');

        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); // Sort by due date

        filtered.forEach(account => {
          const customer = customers.find(c => String(c.id) === String(account.customerId)); // Comparar IDs como strings
          const isOverdue = new Date(account.dueDate) < new Date() && account.status === 'pending';
          const statusClass = isOverdue ? 'status-low-stock' : 'status-pending'; // Red for overdue, yellow for pending
          const statusText = isOverdue ? 'Vencida' : 'Pendiente';
          const statusIcon = isOverdue ? 'fas fa-exclamation-circle' : 'fas fa-clock';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${customer ? customer.name : account.customerName}</strong></td>
            <td>#${account.saleId}</td>
            <td>${new Date(account.createdAt).toLocaleDateString()}</td>
            <td><strong>${ui.formatCurrency(account.amount)}</strong></td>
            <td>${new Date(account.dueDate).toLocaleDateString()}</td>
            <td><span class="status-badge ${statusClass}"><i class="${statusIcon}"></i> ${statusText}</span></td>
            <td class="no-print">
              <button class="btn btn-sm btn-secondary" data-action="mark-paid" data-id="${account.id}">
                <i class="fas fa-check"></i> Marcar como Pagada
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async markAsPaid(id) {
        ui.confirmAction('¿Marcar esta cuenta por cobrar como pagada?', async () => {
          try {
            const account = await storage.get('accountsReceivable', id);
            if (account) {
              account.status = 'paid';
              account.paidAt = new Date().toISOString();
              await storage.update('accountsReceivable', account);
              ui.showToast('Cuenta por cobrar marcada como pagada.');
              this.loadAccountsReceivable();
            }
          } catch (error) {
            console.error("Error marking AR as paid:", error);
            ui.showToast('Error al marcar como pagada.');
          }
        });
      }
    }

    // ===== ACCOUNTS PAYABLE MANAGER =====
    class AccountsPayableManager {
      async loadAccountsPayable() {
        const accounts = await storage.get('accountsPayable');
        const suppliers = await storage.get('suppliers');
        const tableBody = document.querySelector('#accountsPayableTable tbody');
        tableBody.innerHTML = '';

        const filtered = accounts.filter(acc => acc.status === 'pending');

        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); // Sort by due date

        filtered.forEach(account => {
          const supplier = suppliers.find(s => String(s.id) === String(account.supplierId)); // Comparar IDs como strings
          const isOverdue = new Date(account.dueDate) < new Date() && account.status === 'pending';
          const statusClass = isOverdue ? 'status-low-stock' : 'status-pending'; // Red for overdue, yellow for pending
          const statusText = isOverdue ? 'Vencida' : 'Pendiente';
          const statusIcon = isOverdue ? 'fas fa-exclamation-circle' : 'fas fa-clock';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${supplier ? supplier.name : account.supplierName}</strong></td>
            <td>#${account.purchaseId}</td>
            <td>${new Date(account.createdAt).toLocaleDateString()}</td>
            <td><strong>${ui.formatCurrency(account.amount)}</strong></td>
            <td>${new Date(account.dueDate).toLocaleDateString()}</td>
            <td><span class="status-badge ${statusClass}"><i class="${statusIcon}"></i> ${statusText}</span></td>
            <td class="no-print">
              <button class="btn btn-sm btn-secondary" data-action="mark-paid" data-id="${account.id}">
                <i class="fas fa-check"></i> Marcar como Pagada
              </button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }

      async markAsPaid(id) {
        ui.confirmAction('¿Marcar esta cuenta por pagar como pagada?', async () => {
          try {
            const account = await storage.get('accountsPayable', id);
            if (account) {
              account.status = 'paid';
              account.paidAt = new Date().toISOString();
              await storage.update('accountsPayable', account);
              ui.showToast('Cuenta por pagar marcada como pagada.');
              this.loadAccountsPayable();
            }
          } catch (error) {
            console.error("Error marking AP as paid:", error);
            ui.showToast('Error al marcar como pagada.');
          }
        });
      }
    }

    // ===== CASH REPORT MANAGER =====
    class CashReportManager {
      async loadCashReport() {
        const reportDate = document.getElementById('cashReportDate').value;
        const sales = await storage.get('sales');
        const expenses = await storage.get('expenses');
        const reportContentDiv = document.getElementById('cashReportContent');

        if (!reportDate) {
          reportContentDiv.innerHTML = '<p class="text-center text-muted-foreground">Selecciona una fecha para ver el reporte de caja.</p>';
          return;
        }

        const startOfDay = new Date(reportDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(reportDate);
        endOfDay.setHours(23, 59, 59, 999);

        const dailySales = sales.filter(s => {
          const saleDate = new Date(s.createdAt);
          return saleDate >= startOfDay && saleDate <= endOfDay && s.paymentStatus === 'paid';
        });

        const dailyExpenses = expenses.filter(e => {
          const expenseDate = new Date(e.createdAt);
          return expenseDate >= startOfDay && expenseDate <= endOfDay;
        });

        let totalIncome = 0;
        let incomeDetails = {};
        dailySales.forEach(sale => {
          totalIncome += sale.total;
          incomeDetails[sale.paymentMethod] = (incomeDetails[sale.paymentMethod] || 0) + sale.total;
        });

        let totalExpenses = 0;
        let expenseDetails = {};
        dailyExpenses.forEach(expense => {
          totalExpenses += expense.amount;
          expenseDetails[expense.category] = (expenseDetails[expense.category] || 0) + expense.amount;
        });

        const netCashFlow = totalIncome - totalExpenses;

        let incomeHtml = '<h4>Ingresos:</h4>';
        if (Object.keys(incomeDetails).length > 0) {
          incomeHtml += `<ul>`;
          for (const method in incomeDetails) {
            incomeHtml += `<li>${method.charAt(0).toUpperCase() + method.slice(1)}: ${ui.formatCurrency(incomeDetails[method])}</li>`;
          }
          incomeHtml += `</ul>`;
        } else {
          incomeHtml += `<p>No hay ingresos registrados para esta fecha.</p>`;
        }

        let expensesHtml = '<h4>Egresos:</h4>';
        if (Object.keys(expenseDetails).length > 0) {
          expensesHtml += `<ul>`;
          for (const category in expenseDetails) {
            expensesHtml += `<li>${category}: ${ui.formatCurrency(expenseDetails[category])}</li>`;
          }
          expensesHtml += `</ul>`;
        } else {
          expensesHtml += `<p>No hay egresos registrados para esta fecha.</p>`;
        }

        reportContentDiv.innerHTML = `
          <div class="card-content">
            <p><strong>Fecha del Reporte:</strong> ${new Date(reportDate).toLocaleDateString()}</p>
            <hr style="margin: 1rem 0;">
            ${incomeHtml}
            <hr style="margin: 1rem 0;">
            ${expensesHtml}
            <hr style="margin: 1rem 0;">
            <p style="font-size: 1.1em; font-weight: bold;">Total Ingresos: ${ui.formatCurrency(totalIncome)}</p>
            <p style="font-size: 1.1em; font-weight: bold;">Total Egresos: ${ui.formatCurrency(totalExpenses)}</p>
            <p style="font-size: 1.2em; font-weight: bold; color: ${netCashFlow >= 0 ? 'var(--secondary)' : 'var(--destructive)'};">
              Flujo Neto de Caja: ${ui.formatCurrency(netCashFlow)}
            </p>
          </div>
        `;
      }
    }

    // ===== DASHBOARD MANAGER =====
    class DashboardManager {
      chart = null;

      async loadDashboard() {
        const sales = await storage.get('sales');
        const purchases = await storage.get('purchases');
        const products = await storage.get('products');
        const expenses = await storage.get('expenses');

        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const totalPurchasesCost = purchases.reduce((sum, p) => sum + p.total, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        
        // Calculate COGS for net profit
        let cogs = 0;
        for (const sale of sales) {
            for (const item of sale.items) {
                const product = products.find(p => String(p.id) === String(item.productId)); // Comparar IDs como strings
                if (product && product.avgCostPrice) {
                    cogs += item.quantity * product.avgCostPrice;
                } else if (product && product.costPrice) { // Fallback if avgCostPrice is not set
                    cogs += item.quantity * product.costPrice;
                }
            }
        }
        const grossProfit = totalSales - cogs;
        const netProfit = grossProfit - totalExpenses;

        const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

        document.getElementById('totalSales').textContent = ui.formatCurrency(totalSales);
        document.getElementById('totalPurchasesCost').textContent = ui.formatCurrency(totalPurchasesCost);
        document.getElementById('netProfit').textContent = ui.formatCurrency(netProfit);
        document.getElementById('totalStock').textContent = totalStock;

        // Sales chart
        const today = new Date();
        const dates = [];
        const salesData = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dates.push(date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));
          const dailySales = sales
            .filter(s => s.date === dateStr)
            .reduce((sum, s) => sum + s.total, 0);
          salesData.push(dailySales);
        }

        const ctx = document.getElementById('salesChart').getContext('2d');
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: dates,
            datasets: [{
              label: 'Ventas Diarias',
              data: salesData,
              backgroundColor: 'rgba(8, 145, 178, 0.1)',
              borderColor: 'var(--primary)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: 'var(--primary)',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  color: 'var(--border)'
                },
                ticks: {
                  color: 'var(--muted-foreground)',
                  callback: function(value) {
                    return ui.formatCurrency(value);
                  }
                }
              },
              x: {
                grid: {
                  color: 'var(--border)'
                },
                ticks: {
                  color: 'var(--muted-foreground)'
                }
              }
            }
          }
        });

        // Top products
        const productSales = {};
        sales.forEach(sale => {
          sale.items.forEach(item => {
            if (!productSales[item.productId]) {
              productSales[item.productId] = { 
                name: item.productName, 
                qty: 0, 
                revenue: 0 
              };
            }
            productSales[item.productId].qty += item.quantity;
            productSales[item.productId].revenue += item.quantity * item.sellPrice;
          });
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        const tableBody = document.getElementById('topProductsTable').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '';
        topProducts.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td><span class="status-badge">${p.qty} unidades</span></td>
            <td><strong>${ui.formatCurrency(p.revenue)}</strong></td>
          `;
          tableBody.appendChild(tr);
        });

        // Low stock products
        const minStock = settingsManager.settings.minStock || 5;
        const lowStockProducts = products.filter(p => p.stock <= minStock);
        const lowStockTableBody = document.getElementById('lowStockTable').getElementsByTagName('tbody')[0];
        lowStockTableBody.innerHTML = '';
        if (lowStockProducts.length > 0) {
          lowStockProducts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${p.name}</strong></td>
              <td><code>${p.sku}</code></td>
              <td>${p.stock}</td>
              <td>${minStock}</td>
            `;
            lowStockTableBody.appendChild(tr);
          });
        } else {
          lowStockTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted-foreground">No hay productos con stock bajo.</td></tr>`;
        }
      }
    }

    // ===== REPORT MANAGER =====
    class ReportManager {
      async generateReport() {
        const reportType = document.getElementById('reportType').value;
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        const reportContentDiv = document.getElementById('reportContent');
        const reportCardTitle = document.getElementById('reportCardTitle');

        if (!startDate || !endDate) {
          ui.showToast('Por favor, selecciona un rango de fechas para el reporte.');
          return;
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        if (start > end) {
          ui.showToast('La fecha de inicio no puede ser posterior a la fecha de fin.');
          return;
        }

        reportContentDiv.innerHTML = `<p class="text-center text-muted-foreground">Generando reporte...</p>`;
        reportCardTitle.textContent = `Reporte de ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} (${new Date(startDate).toLocaleDateString()} a ${new Date(endDate).toLocaleDateString()})`;

        let htmlContent = `
          <div class="report-print-area" style="padding: 2rem;">
            <h2 style="text-align: center; margin-bottom: 1.5rem;">Reporte de ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</h2>
            <p style="text-align: center; margin-bottom: 2rem;">Periodo: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
        `;
        let csvData = [];
        let csvHeaders = [];

        switch (reportType) {
          case 'sales':
            const sales = await storage.get('sales');
            const filteredSales = sales.filter(s => {
              const saleDate = new Date(s.date);
              return saleDate >= start && saleDate <= end;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));

            let totalSalesAmount = 0;
            if (filteredSales.length > 0) {
              csvHeaders = ['Fecha', 'Cliente', 'Total', 'Estado Pago', 'Metodo Pago', 'Items Vendidos', 'IMEIs Vendidos'];
              csvData.push(csvHeaders);

              htmlContent += `
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Estado Pago</th>
                        <th>Método Pago</th>
                        <th>Items</th>
                        <th>IMEIs Vendidos</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              filteredSales.forEach(sale => {
                totalSalesAmount += sale.total;
                const imeiList = sale.imeisSold && sale.imeisSold.length > 0 ? sale.imeisSold.join(', ') : 'N/A';
                htmlContent += `
                  <tr>
                    <td>${new Date(sale.date).toLocaleDateString()}</td>
                    <td>${sale.customerName}</td>
                    <td>${ui.formatCurrency(sale.total)}</td>
                    <td>${sale.paymentStatus}</td>
                    <td>${sale.paymentMethod}</td>
                    <td>${sale.items.length}</td>
                    <td>${imeiList}</td>
                  </tr>
                `;
                csvData.push([
                  new Date(sale.date).toLocaleDateString(),
                  sale.customerName,
                  sale.total,
                  sale.paymentStatus,
                  sale.paymentMethod,
                  sale.items.length,
                  imeiList
                ]);
              });
              htmlContent += `
                    </tbody>
                  </table>
                </div>
                <h3 style="text-align: right; margin-top: 1.5rem;">Total Ventas: ${ui.formatCurrency(totalSalesAmount)}</h3>
              `;
            } else {
              htmlContent += `<p class="text-center text-muted-foreground">No hay ventas en el periodo seleccionado.</p>`;
            }
            break;

          case 'inventory':
            const products = await storage.get('products');
            const minStock = settingsManager.settings.minStock || 5;

            if (products.length > 0) {
              csvHeaders = ['Producto', 'SKU', 'Categoría', 'Stock', 'Precio Venta', 'Costo Promedio', 'Estado Stock', 'IMEIs Disponibles'];
              csvData.push(csvHeaders);

              htmlContent += `
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>Precio Venta</th>
                        <th>Costo Promedio</th>
                        <th>Estado</th>
                        <th>IMEIs Disponibles</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              products.forEach(product => {
                const stockBadge = product.stock <= minStock ? 
                  `<span class="status-badge status-low-stock"><i class="fas fa-exclamation-triangle"></i> Bajo</span>` :
                  `<span class="status-badge status-paid"><i class="fas fa-check"></i> OK</span>`;
                const imeiList = product.imeis && product.imeis.length > 0 ? product.imeis.join(', ') : 'N/A';
                htmlContent += `
                  <tr>
                    <td>${product.name}</td>
                    <td>${product.sku}</td>
                    <td>${product.category}</td>
                    <td>${product.stock}</td>
                    <td>${ui.formatCurrency(product.sellPrice)}</td>
                    <td>${ui.formatCurrency(product.avgCostPrice || product.costPrice || 0)}</td>
                    <td>${stockBadge}</td>
                    <td>${imeiList}</td>
                  </tr>
                `;
                csvData.push([
                  product.name,
                  product.sku,
                  product.category,
                  product.stock,
                  product.sellPrice,
                  product.avgCostPrice || product.costPrice || 0,
                  product.stock <= minStock ? 'Bajo' : 'OK',
                  imeiList
                ]);
              });
              htmlContent += `
                    </tbody>
                  </table>
                </div>
              `;
            } else {
              htmlContent += `<p class="text-center text-muted-foreground">No hay productos en el inventario.</p>`;
            }
            break;

          case 'customers':
            const customers = await storage.get('customers');
            const filteredCustomers = customers.filter(c => {
              const customerCreatedAt = new Date(c.createdAt);
              return customerCreatedAt >= start && customerCreatedAt <= end;
            }).sort((a, b) => b.totalPurchases - a.totalPurchases);

            if (filteredCustomers.length > 0) {
              csvHeaders = ['Nombre', 'Telefono', 'Email', 'Documento', 'Direccion', 'Total Compras', 'Ultima Compra'];
              csvData.push(csvHeaders);

              htmlContent += `
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        <th>Documento</th>
                        <th>Dirección</th>
                        <th>Total Compras</th>
                        <th>Última Compra</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              filteredCustomers.forEach(customer => {
                htmlContent += `
                  <tr>
                    <td>${customer.name}</td>
                    <td>${customer.phone || 'N/A'}</td>
                    <td>${customer.email || 'N/A'}</td>
                    <td>${customer.document || 'N/A'}</td>
                    <td>${customer.address || 'N/A'}</td>
                    <td>${ui.formatCurrency(customer.totalPurchases || 0)}</td>
                    <td>${customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                `;
                csvData.push([
                  customer.name,
                  customer.phone || 'N/A',
                  customer.email || 'N/A',
                  customer.document || 'N/A',
                  customer.address || 'N/A',
                  customer.totalPurchases || 0,
                  customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString() : 'N/A'
                ]);
              });
              htmlContent += `
                    </tbody>
                  </table>
                </div>
              `;
            } else {
              htmlContent += `<p class="text-center text-muted-foreground">No hay clientes registrados en el periodo.</p>`;
            }
            break;

          case 'profit':
            const allSales = await storage.get('sales');
            const allPurchases = await storage.get('purchases');
            const allExpenses = await storage.get('expenses');
            const allProducts = await storage.get('products');

            const salesInPeriod = allSales.filter(s => {
              const saleDate = new Date(s.date);
              return saleDate >= start && saleDate <= end;
            });

            const expensesInPeriod = allExpenses.filter(e => {
              const expenseDate = new Date(e.date);
              return expenseDate >= start && expenseDate <= end;
            });

            const totalRevenue = salesInPeriod.reduce((sum, s) => sum + s.total, 0);
            const totalExpensesAmount = expensesInPeriod.reduce((sum, e) => sum + e.amount, 0);

            // Calculate Cost of Goods Sold (COGS) for sales in the period
            let cogs = 0;
            for (const sale of salesInPeriod) {
                for (const item of sale.items) {
                    const product = allProducts.find(p => String(p.id) === String(item.productId)); // Comparar IDs como strings
                    if (product && product.avgCostPrice) {
                        cogs += item.quantity * product.avgCostPrice;
                    } else if (product && product.costPrice) { // Fallback if avgCostPrice is not set
                        cogs += item.quantity * product.costPrice;
                    }
                }
            }

            const grossProfit = totalRevenue - cogs;
            const netProfit = grossProfit - totalExpensesAmount;

            htmlContent += `
              <div style="background: var(--muted); padding: 1.5rem; border-radius: var(--radius); margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">Resumen de Rentabilidad</h3>
                <p style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span>Ingresos Totales (Ventas):</span>
                  <strong>${ui.formatCurrency(totalRevenue)}</strong>
                </p>
                <p style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span>Costo de Bienes Vendidos (COGS):</span>
                  <strong>${ui.formatCurrency(cogs)}</strong>
                </p>
                <p style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span>Gastos Operativos:</span>
                  <strong>${ui.formatCurrency(totalExpensesAmount)}</strong>
                </p>
                <hr style="border-color: var(--border); margin: 1rem 0;">
                <p style="display: flex; justify-content: space-between; font-size: 1.1em; font-weight: bold;">
                  <span>Beneficio Bruto:</span>
                  <strong>${ui.formatCurrency(grossProfit)}</strong>
                </p>
                <p style="display: flex; justify-content: space-between; font-size: 1.2em; font-weight: bold; margin-top: 1rem;">
                  <span>Beneficio Neto Estimado:</span>
                  <strong>${ui.formatCurrency(netProfit)}</strong>
                </p>
              </div>
            `;
            csvHeaders = ['Métrica', 'Valor'];
            csvData.push(csvHeaders);
            csvData.push(['Ingresos Totales (Ventas)', totalRevenue]);
            csvData.push(['Costo de Bienes Vendidos (COGS)', cogs]);
            csvData.push(['Gastos Operativos', totalExpensesAmount]);
            csvData.push(['Beneficio Bruto', grossProfit]);
            csvData.push(['Beneficio Neto Estimado', netProfit]);
            break;

          case 'expenses':
            const expenses = await storage.get('expenses');
            const filteredExpenses = expenses.filter(e => {
              const expenseDate = new Date(e.date);
              return expenseDate >= start && expenseDate <= end;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));

            let totalExpensesReport = 0;
            if (filteredExpenses.length > 0) {
              csvHeaders = ['Fecha', 'Concepto', 'Categoria', 'Monto', 'Descripcion'];
              csvData.push(csvHeaders);

              htmlContent += `
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Categoría</th>
                        <th>Monto</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              filteredExpenses.forEach(expense => {
                totalExpensesReport += expense.amount;
                htmlContent += `
                  <tr>
                    <td>${new Date(expense.date).toLocaleDateString()}</td>
                    <td>${expense.concept}</td>
                    <td>${expense.category}</td>
                    <td>${ui.formatCurrency(expense.amount)}</td>
                    <td>${expense.description || 'N/A'}</td>
                  </tr>
                `;
                csvData.push([
                  new Date(expense.date).toLocaleDateString(),
                  expense.concept,
                  expense.category,
                  expense.amount,
                  expense.description || 'N/A'
                ]);
              });
              htmlContent += `
                    </tbody>
                  </table>
                </div>
                <h3 style="text-align: right; margin-top: 1.5rem;">Total Gastos: ${ui.formatCurrency(totalExpensesReport)}</h3>
              `;
            } else {
              htmlContent += `<p class="text-center text-muted-foreground">No hay gastos en el periodo seleccionado.</p>`;
            }
            break;

          case 'accountsReceivable':
            const ar = await storage.get('accountsReceivable');
            const filteredAr = ar.filter(acc => {
              const accDate = new Date(acc.createdAt);
              return accDate >= start && accDate <= end;
            }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

            if (filteredAr.length > 0) {
              csvHeaders = ['Cliente', 'Venta #', 'Fecha Venta', 'Monto', 'Fecha Vencimiento', 'Estado'];
              csvData.push(csvHeaders);

              htmlContent += `
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Venta #</th>
                        <th>Fecha Venta</th>
                        <th>Monto</th>
                        <th>Fecha Vencimiento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              filteredAr.forEach(account => {
                const isOverdue = new Date(account.dueDate) < new Date() && account.status === 'pending';
                const statusText = isOverdue ? 'Vencida' : (account.status === 'pending' ? 'Pendiente' : 'Pagada');
                htmlContent += `
                  <tr>
                    <td>${account.customerName}</td>
                    <td>#${account.saleId}</td>
                    <td>${new Date(account.createdAt).toLocaleDateString()}</td>
                    <td>${ui.formatCurrency(account.amount)}</td>
                    <td>${new Date(account.dueDate).toLocaleDateString()}</td>
                    <td>${statusText}</td>
                  </tr>
                `;
                csvData.push([
                  account.customerName,
                  `#${account.saleId}`,
                  new Date(account.createdAt).toLocaleDateString(),
                  account.amount,
                  new Date(account.dueDate).toLocaleDateString(),
                  statusText
                ]);
              });
              htmlContent += `
                    </tbody>
                  </table>
                </div>
              `;
            } else {
              htmlContent += `<p class="text-center text-muted-foreground">No hay cuentas por cobrar en el periodo seleccionado.</p>`;
            }
            break;

          case 'accountsPayable':
            const ap = await storage.get('accountsPayable');
            const filteredAp = ap.filter(acc => {
              const accDate = new Date(acc.createdAt);
              return accDate >= start && accDate <= end;
            }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

            if (filteredAp.length > 0) {
              csvHeaders = ['Proveedor', 'Compra #', 'Fecha Compra', 'Monto', 'Fecha Vencimiento', 'Estado'];
              csvData.push(csvHeaders);

              htmlContent += `
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Proveedor</th>
                        <th>Compra #</th>
                        <th>Fecha Compra</th>
                        <th>Monto</th>
                        <th>Fecha Vencimiento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              filteredAp.forEach(account => {
                const isOverdue = new Date(account.dueDate) < new Date() && account.status === 'pending';
                const statusText = isOverdue ? 'Vencida' : (account.status === 'pending' ? 'Pendiente' : 'Pagada');
                htmlContent += `
                  <tr>
                    <td>${account.supplierName}</td>
                    <td>#${account.purchaseId}</td>
                    <td>${new Date(account.createdAt).toLocaleDateString()}</td>
                    <td>${ui.formatCurrency(account.amount)}</td>
                    <td>${new Date(account.dueDate).toLocaleDateString()}</td>
                    <td>${statusText}</td>
                  </tr>
                `;
                csvData.push([
                  account.supplierName,
                  `#${account.purchaseId}`,
                  new Date(account.createdAt).toLocaleDateString(),
                  account.amount,
                  new Date(account.dueDate).toLocaleDateString(),
                  statusText
                ]);
              });
              htmlContent += `
                    </tbody>
                  </table>
                </div>
              `;
            } else {
              htmlContent += `<p class="text-center text-muted-foreground">No hay cuentas por pagar en el periodo seleccionado.</p>`;
            }
            break;

          default:
            htmlContent += `<p class="text-center text-muted-foreground">Tipo de reporte no reconocido.</p>`;
            break;
        }

        htmlContent += `</div>`; // Close report-print-area
        reportContentDiv.innerHTML = htmlContent;
        ui.showToast('Reporte generado exitosamente');

        // Store CSV data for export button
        this.currentReportCSVData = csvData;
        this.currentReportType = reportType;
      }

      exportReportPDF() {
        const reportContentDiv = document.getElementById('reportContent');
        if (reportContentDiv.innerHTML.includes('Selecciona los parámetros')) {
          ui.showToast('Primero genera un reporte para poder exportarlo.');
          return;
        }

        const reportPrintArea = reportContentDiv.querySelector('.report-print-area');
        if (!reportPrintArea) {
            ui.showToast('Contenido del reporte no encontrado para exportar.');
            return;
        }

        // Temporarily make the report print area visible for html2canvas
        reportPrintArea.style.display = 'block';
        reportPrintArea.style.position = 'absolute';
        reportPrintArea.style.left = '0';
        reportPrintArea.style.top = '0';
        reportPrintArea.style.width = '100%';
        reportPrintArea.style.height = 'auto';
        reportPrintArea.style.background = 'white';
        reportPrintArea.style.color = 'black';
        reportPrintArea.style.boxShadow = 'none';
        reportPrintArea.style.overflow = 'visible';

        html2canvas(reportPrintArea, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new window.jspdf.jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            pdf.save(`reporte-${this.currentReportType || 'general'}-${new Date().toISOString().split('T')[0]}.pdf`);
        }).catch(error => {
            console.error("Error generating PDF:", error);
            ui.showToast("Error al generar PDF. Intenta de nuevo.");
        }).finally(() => {
            // Restore original styles
            reportPrintArea.style.display = '';
            reportPrintArea.style.position = '';
            reportPrintArea.style.left = '';
            reportPrintArea.style.top = '';
            reportPrintArea.style.width = '';
            reportPrintArea.style.height = '';
            reportPrintArea.style.background = '';
            reportPrintArea.style.color = '';
            reportPrintArea.style.boxShadow = '';
            reportPrintArea.style.overflow = '';
        });
      }

      exportReportCSV() {
        if (!this.currentReportCSVData || this.currentReportCSVData.length === 0) {
          ui.showToast('Primero genera un reporte para poder exportarlo a CSV.');
          return;
        }
        const csv = Papa.unparse(this.currentReportCSVData);
        productManager.downloadFile(csv, `reporte-${this.currentReportType || 'general'}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      }
    }

    // ===== USER MANAGER (NUEVO) =====
    class UserManager {
      async loadUsers() {
        const users = await storage.get('users'); // Obtener usuarios de Firestore
        const tableBody = document.querySelector('#usersTable tbody');
        tableBody.innerHTML = '';

        users.forEach(user => {
          const tr = document.createElement('tr');
          const isCurrentUser = authManager.currentUser && authManager.currentUser.uid === user.id;
          const canEdit = authManager.isAdmin; // Solo administradores pueden editar
          const canDelete = authManager.isAdmin && !isCurrentUser; // No permitir que Javier se elimine a sí mismo

          tr.innerHTML = `
            <td><strong>${user.email}</strong></td>
            <td>${user.username || 'N/A'}</td>
            <td><span class="status-badge">${user.role}</span></td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Nunca'}</td>
            <td class="no-print">
              ${canEdit ? `
                <button class="btn btn-sm btn-outline" data-action="edit-user" data-id="${user.id}">
                  <i class="fas fa-edit"></i> Editar
                </button>
              ` : ''}
              ${canDelete ? `
                <button class="btn btn-sm btn-destructive" data-action="delete-user" data-id="${user.id}">
                  <i class="fas fa-user-minus"></i> Eliminar
                </button>
              ` : ''}
            </td>
          `;
          tableBody.appendChild(tr);
        });

        // **CORRECCIÓN:** Adjuntar event listeners después de cargar los usuarios
        this.attachUserTableEventListeners();
      }

      // **NUEVO MÉTODO:** Para adjuntar event listeners a los botones de la tabla de usuarios
      attachUserTableEventListeners() {
        const usersTable = document.getElementById('usersTable');
        if (usersTable) {
          usersTable.removeEventListener('click', this._handleUserTableClick); // Evitar duplicados
          this._handleUserTableClick = (e) => {
            const target = e.target.closest('button');
            if (target) {
              const action = target.dataset.action;
              const id = target.dataset.id;

              if (action === 'edit-user') {
                this.editUser(id);
              } else if (action === 'delete-user') {
                this.deleteUser(id);
              }
            }
          };
          usersTable.addEventListener('click', this._handleUserTableClick);
        }
      }

      async addUser() {
        const body = `
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="userEmail" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña *</label>
            <input type="password" class="form-input" id="userPassword" required>
          </div>
          <div class="form-group">
            <label class="form-label">Rol *</label>
            <select class="form-select" id="userRole">
              <option value="Javier">Administrador</option>
              <option value="Diego">Cajero</option>
              <option value="Nena">Bodeguero</option>
            </select>
          </div>
        `;

        ui.showModal('Nuevo Usuario', body, async () => {
          const email = document.getElementById('userEmail').value.trim();
          const password = document.getElementById('userPassword').value.trim();
          const role = document.getElementById('userRole').value;

          if (!email || !password || !role) {
            ui.showToast('Todos los campos son obligatorios.');
            return;
          }

          // Usar el método de AuthManager para crear el usuario
          const success = await authManager.createNewUser(email, password, role);
          if (success) {
            ui.closeModal();
            this.loadUsers(); // Recargar la lista de usuarios
          }
        });
      }

      async editUser(userId) {
        const user = await storage.get('users', userId);
        if (!user) {
          ui.showToast('Usuario no encontrado.');
          return;
        }

        const body = `
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="editUserEmail" value="${user.email}" readonly>
            <small style="color: var(--muted-foreground);">El email no se puede cambiar directamente desde aquí.</small>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre de Usuario *</label>
            <input type="text" class="form-input" id="editUserName" value="${user.username || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Rol *</label>
            <select class="form-select" id="editUserRole">
              <option value="Javier" ${user.role === 'Javier' ? 'selected' : ''}>Administrador</option>
              <option value="Diego" ${user.role === 'Diego' ? 'selected' : ''}>Cajero</option>
              <option value="Nena" ${user.role === 'Nena' ? 'selected' : ''}>Bodeguero</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nueva Contraseña (dejar vacío para no cambiar)</label>
            <input type="password" class="form-input" id="editUserPassword" placeholder="Mínimo 6 caracteres">
            <small style="color: var(--destructive);">
                **ADVERTENCIA:** En un entorno de producción, el cambio de contraseña de otro usuario
                debería realizarse a través de Firebase Cloud Functions por seguridad.
                Esta es una simulación.
            </small>
          </div>
        `;

        ui.showModal('Editar Usuario', body, async () => {
          const updatedUserName = document.getElementById('editUserName').value.trim();
          const updatedUserRole = document.getElementById('editUserRole').value;
          const newPassword = document.getElementById('editUserPassword').value.trim();

          if (!updatedUserName || !updatedUserRole) {
            ui.showToast('Nombre de usuario y rol son obligatorios.');
            return;
          }

          const updatedProfile = {
            username: updatedUserName,
            role: updatedUserRole,
            updatedAt: new Date().toISOString()
          };

          let profileUpdateSuccess = false;
          let passwordUpdateSuccess = true; // Assume true if no password is provided

          // Update user profile in Firestore
          profileUpdateSuccess = await authManager.updateUserProfile(userId, updatedProfile);

          // If a new password is provided, attempt to update it (simulated)
          if (newPassword) {
            passwordUpdateSuccess = await authManager.updateUserPasswordByAdmin(userId, newPassword);
          }

          if (profileUpdateSuccess && passwordUpdateSuccess) {
            ui.closeModal();
            ui.showToast('Usuario actualizado exitosamente.');
            this.loadUsers(); // Recargar la lista de usuarios
          } else {
            ui.showToast('Error al actualizar usuario. Revisa la consola.');
          }
        });
      }

      async deleteUser(userId) {
        ui.confirmAction('¿Está seguro de eliminar este usuario? Esta acción es irreversible y eliminará la cuenta de autenticación (simulado).', async () => {
          // Usar el método de AuthManager para eliminar el usuario
          const success = await authManager.deleteUserByAdmin(userId);
          if (success) {
            this.loadUsers(); // Recargar la lista de usuarios
          }
        });
      }
    }

    // ===== SETTINGS MANAGER =====
    class SettingsManager {
      settings = {
        companyName: 'CeluStore',
        companyNIT: '987654321',
        companyAddress: 'Calle Ficticia 123, Ciudad',
        logoURL: 'https://via.placeholder.com/100x50?text=CeluStore',
        taxRate: 19,
        currency: 'COP',
        theme: 'light',
        minStock: 5
      };

      async loadSettings() {
        try {
          const saved = await storage.get('settings');
          if (saved.length > 0) {
            this.settings = { ...this.settings, ...saved[0] };
          }

          document.getElementById('settingCompanyName').value = this.settings.companyName;
          document.getElementById('settingCompanyNIT').value = this.settings.companyNIT;
          document.getElementById('settingLogoURL').value = this.settings.logoURL;
          document.getElementById('settingTaxRate').value = this.settings.taxRate;
          document.getElementById('settingCurrency').value = this.settings.currency;
          document.getElementById('settingMinStock').value = this.settings.minStock;

          // Apply theme
          document.documentElement.setAttribute('data-theme', this.settings.theme);
          const themeIcon = document.querySelector('#themeToggle i');
          themeIcon.className = this.settings.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

          // Event listeners
          document.getElementById('settingCompanyName').onchange = (e) => {
            this.settings.companyName = e.target.value;
            this.saveSettings();
          };
          document.getElementById('settingCompanyNIT').onchange = (e) => {
            this.settings.companyNIT = e.target.value;
            this.saveSettings();
          };
          document.getElementById('settingLogoURL').onchange = (e) => {
            this.settings.logoURL = e.target.value;
            this.saveSettings();
          };
          document.getElementById('settingTaxRate').onchange = (e) => {
            this.settings.taxRate = parseFloat(e.target.value) || 0;
            this.saveSettings();
          };
          document.getElementById('settingCurrency').onchange = (e) => {
            this.settings.currency = e.target.value;
            this.saveSettings();
          };
          document.getElementById('settingMinStock').onchange = (e) => {
            this.settings.minStock = parseInt(e.target.value) || 5;
            this.saveSettings();
          };

          document.getElementById('btnBackup').onclick = () => this.backupData();
          document.getElementById('btnRestore').onclick = () => {
            document.getElementById('restoreFile').click();
          };
          document.getElementById('restoreFile').onchange = (e) => this.restoreFromJSON(e);
        } catch (error) {
          console.error("Error loading settings:", error);
          ui.showToast("Error al cargar la configuración.");
        }
      }

      async saveSettings() {
        try {
          const settingsDoc = { id: 'app_settings', ...this.settings };
          await storage.set('settings', [settingsDoc]);
          ui.showToast('Configuración guardada');
        } catch (error) {
          console.error("Error saving settings:", error);
          ui.showToast("Error al guardar la configuración.");
        }
      }

      async backupData() {
        const data = {};
        for (const store of STORE_NAMES) {
          data[store] = await storage.get(store);
        }
        data.timestamp = new Date().toISOString();
        data.version = '2.0';
        
        let json = JSON.stringify(data, null, 2);
        const encryptionKey = document.getElementById('encryptionKey').value.trim();

        if (encryptionKey) {
          try {
            json = CryptoJS.AES.encrypt(json, encryptionKey).toString();
            ui.showToast('Backup cifrado y descargado exitosamente');
          } catch (e) {
            ui.showToast('Error al cifrar el backup. Asegúrate de que la contraseña sea válida.');
            console.error('Encryption error:', e);
            return;
          }
        } else {
          ui.showToast('Backup descargado exitosamente');
        }
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `celustore-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      async restoreFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            let fileContent = e.target.result;
            const encryptionKey = document.getElementById('encryptionKey').value.trim();

            if (encryptionKey) {
              try {
                const decryptedBytes = CryptoJS.AES.decrypt(fileContent, encryptionKey);
                fileContent = decryptedBytes.toString(CryptoJS.enc.Utf8);
                if (!fileContent) {
                  throw new Error('Contraseña incorrecta o datos corruptos.');
                }
              } catch (decryptionError) {
                ui.showToast('Error al descifrar el backup. Contraseña incorrecta o archivo corrupto.');
                console.error('Decryption error:', decryptionError);
                return;
              }
            }

            const data = JSON.parse(fileContent);
            
            // Validate backup structure
            if (!data.version) {
              ui.showToast('Formato de backup no válido');
              return;
            }
            
            for (const store of STORE_NAMES) {
              if (data[store]) {
                const dataWithFirebaseIds = data[store].map(item => ({
                    ...item,
                    id: item.id ? String(item.id) : undefined
                }));
                await storage.set(store, dataWithFirebaseIds);
              }
            }
            
            ui.showToast('Datos restaurados exitosamente. Recargando...');
            setTimeout(() => location.reload(), 1500);
          } catch (err) {
            ui.showToast('Error al restaurar: archivo inválido o corrupto');
            console.error('Restore error:', err);
          }
        };
        reader.readAsText(file);
      }
    }

    // ===== INITIALIZATION =====
    const authManager = new AuthManager(); // Renombrado para evitar conflicto con la instancia de Firebase Auth
    const storage = new StorageManager();
    const ui = new UIManager();
    const productManager = new ProductManager();
    const supplierManager = new SupplierManager();
    const purchaseManager = new PurchaseManager();
    const saleManager = new SaleManager();
    const customerManager = new CustomerManager();
    const expenseManager = new ExpenseManager();
    const accountsReceivableManager = new AccountsReceivableManager();
    const accountsPayableManager = new AccountsPayableManager();
    const cashReportManager = new CashReportManager();
    const dashboardManager = new DashboardManager();
    const settingsManager = new SettingsManager();
    const reportManager = new ReportManager();
    const userManager = new UserManager(); // Nueva instancia del gestor de usuarios

    // ===== SAMPLE DATA LOADER =====
    async function loadSampleData() {
      // Crear usuarios de Firebase Auth y sus perfiles en Firestore
      const initialUsers = [
        { email: 'javier@example.com', password: 'password123', role: 'Javier', username: 'Javier' },
        { email: 'diego@example.com', password: 'password123', role: 'Diego', username: 'Diego' },
        { email: 'nena@example.com', password: 'password123', role: 'Nena', username: 'Nena' }
      ];

      for (const userData of initialUsers) {
        try {
          // Intentar crear el usuario en Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
          const user = userCredential.user;
          // Guardar el perfil en Firestore
          await setDoc(doc(db, 'users', user.uid), {
            email: userData.email,
            role: userData.role,
            username: userData.username,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString() // Para el ejemplo
          });
          console.log(`Usuario ${userData.email} creado y perfil guardado.`);
        } catch (error) {
          if (error.code === 'auth/email-already-in-use') {
            console.warn(`Usuario ${userData.email} ya existe en Firebase Auth. Saltando creación.`);
            // Si ya existe, asegúrate de que su perfil de Firestore también exista y esté actualizado
            // Esto es un escenario más complejo que requeriría lógica adicional o una Cloud Function
            // para sincronizar usuarios de Auth con perfiles de Firestore si el perfil no existe.
            // Para este ejemplo, simplemente lo ignoramos si el email ya está en uso.
          } else {
            console.error(`Error al crear usuario ${userData.email}:`, error);
          }
        }
      }

      const suppliers = [
        { 
          id: 'supplier1',
          name: 'ElectroGlobal SAS', 
          nit: '800123456', 
          contact: 'Carlos Ruiz', 
          phone: '3001234567', 
          email: 'ventas@electroglobal.com', 
          address: 'Calle 10 #15-20, Bogotá', 
          notes: 'Principal proveedor de celulares',
          createdAt: '2023-01-01T10:00:00Z'
        },
        { 
          id: 'supplier2',
          name: 'TecnoImport Ltda', 
          nit: '900789012', 
          contact: 'Ana López', 
          phone: '3109876543', 
          email: 'ana@tecnoimport.com', 
          address: 'Av 5 #8-30, Medellín',
          notes: 'Especialistas en accesorios',
          createdAt: '2023-01-05T11:00:00Z'
        },
        { 
          id: 'supplier3',
          name: 'Accesorios del Norte', 
          nit: '700456789', 
          contact: 'Luis Gómez', 
          phone: '3201122334', 
          email: 'luis@accesoriosnorte.com', 
          address: 'Carrera 3 #12-45, Barranquilla',
          notes: 'Fundas y protectores',
          createdAt: '2023-01-10T12:00:00Z'
        }
      ];

      const products = [
        { 
          id: 'product1', 
          name: 'iPhone 15 Pro', 
          sku: 'IPH15P-128', 
          category: 'Celulares', 
          stock: 5, // Stock inicial antes de compras/ventas
          costPrice: 3200000, 
          avgCostPrice: 3200000, 
          sellPrice: 4200000, 
          image: 'https://via.placeholder.com/100x100?text=iPhone15Pro', 
          description: 'iPhone 15 Pro 128GB Titanio Natural',
          imeis: ['IMEI-IPH15P-001', 'IMEI-IPH15P-002', 'IMEI-IPH15P-003', 'IMEI-IPH15P-004', 'IMEI-IPH15P-005'], 
          createdAt: '2023-01-01T10:30:00Z'
        },
        { 
          id: 'product2',
          name: 'Samsung Galaxy S24', 
          sku: 'SGS24-256', 
          category: 'Celulares', 
          stock: 4, 
          costPrice: 2800000, 
          avgCostPrice: 2800000, 
          sellPrice: 3600000, 
          image: 'https://via.placeholder.com/100x100?text=SGS24', 
          description: 'Samsung Galaxy S24 256GB Phantom Black',
          imeis: ['IMEI-SGS24-001', 'IMEI-SGS24-002', 'IMEI-SGS24-003', 'IMEI-SGS24-004'],
          createdAt: '2023-01-02T11:00:00Z'
        },
        { 
          id: 'product3',
          name: 'Cargador Rápido 65W USB-C', 
          sku: 'CRG-65W-C', 
          category: 'Cargadores', 
          stock: 20, 
          costPrice: 55000, 
          avgCostPrice: 55000, 
          sellPrice: 89000, 
          image: 'https://via.placeholder.com/100x100?text=Charger', 
          description: 'Cargador rápido 65W con cable USB-C',
          imeis: [],
          createdAt: '2023-01-03T12:00:00Z'
        },
        { 
          id: 'product4',
          name: 'Funda MagSafe iPhone 15', 
          sku: 'FUN-MAG-15', 
          category: 'Fundas', 
          stock: 15, 
          costPrice: 25000, 
          avgCostPrice: 25000, 
          sellPrice: 45000, 
          image: 'https://via.placeholder.com/100x100?text=Case', 
          description: 'Funda compatible con MagSafe para iPhone 15',
          imeis: [],
          createdAt: '2023-01-04T13:00:00Z'
        },
        { 
          id: 'product5',
          name: 'AirPods Pro 2da Gen', 
          sku: 'APP-2GEN', 
          category: 'Audífonos', 
          stock: 10, 
          costPrice: 650000, 
          avgCostPrice: 650000, 
          sellPrice: 850000, 
          image: 'https://via.placeholder.com/100x100?text=AirPods', 
          description: 'AirPods Pro 2da generación con cancelación de ruido',
          imeis: [],
          createdAt: '2023-01-05T14:00:00Z'
        },
        { 
          id: 'product6',
          name: 'Cable USB-C a Lightning', 
          sku: 'CBL-C-LTG', 
          category: 'Cables', 
          stock: 30, 
          costPrice: 18000, 
          avgCostPrice: 18000, 
          sellPrice: 32000, 
          image: 'https://via.placeholder.com/100x100?text=Cable', 
          description: 'Cable USB-C a Lightning 1m certificado MFi',
          imeis: [],
          createdAt: '2023-01-06T15:00:00Z'
        }
      ];

      const customers = [
        {
          id: 'customer1', 
          name: 'María Pérez',
          phone: '3151234567',
          email: 'maria.perez@email.com',
          address: 'Calle 5 #10-20, Bogotá',
          totalPurchases: 0, // Will be updated by sales
          lastPurchase: null,
          createdAt: '2023-01-15T09:00:00Z'
        },
        {
          id: 'customer2',
          name: 'Juan Gómez',
          phone: '3109876543',
          email: 'juan.gomez@email.com',
          address: 'Av 8 #15-30, Medellín',
          totalPurchases: 0,
          lastPurchase: null,
          createdAt: '2023-01-10T10:00:00Z'
        },
        {
          id: 'customer3',
          name: 'Ana López',
          phone: '3201122334',
          email: 'ana.lopez@email.com',
          address: 'Carrera 3 #12-45, Cali',
          totalPurchases: 0,
          lastPurchase: null,
          createdAt: '2023-01-08T11:00:00Z'
        }
      ];

      const purchases = [
        {
          id: 'purchase1',
          supplierId: 'supplier1',
          date: '2024-01-01',
          items: [
            { productId: 'product1', quantity: 5, costPrice: 3200000, imeis: ['IMEI-IPH15P-001', 'IMEI-IPH15P-002', 'IMEI-IPH15P-003', 'IMEI-IPH15P-004', 'IMEI-IPH15P-005'] }
          ],
          total: (5 * 3200000),
          note: 'Compra inicial de celulares',
          paymentStatus: 'paid',
          dueDate: null,
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          id: 'purchase2',
          supplierId: 'supplier2',
          date: '2024-01-05',
          items: [
            { productId: 'product3', quantity: 20, costPrice: 55000 },
            { productId: 'product4', quantity: 15, costPrice: 25000 }
          ],
          total: (20 * 55000) + (15 * 25000),
          note: 'Restock de accesorios',
          paymentStatus: 'pending',
          dueDate: '2024-02-05',
          createdAt: '2024-01-05T11:00:00Z'
        }
      ];

      const sales = [
        {
          id: 'sale1',
          customerId: 'customer1',
          customerName: 'María Pérez',
          customerPhone: '3151234567',
          customerEmail: 'maria.perez@email.com',
          customerAddress: 'Calle 5 #10-20, Bogotá',
          date: '2024-01-15',
          items: [
            { productId: 'product1', productName: 'iPhone 15 Pro', quantity: 1, sellPrice: 4200000, imeisSold: ['IMEI-IPH15P-001'] }
          ],
          imeisSold: ['IMEI-IPH15P-001'],
          subtotal: 4200000,
          taxRate: 19,
          tax: 4200000 * 0.19,
          discount: 0,
          total: 4200000 * 1.19,
          paymentStatus: 'paid',
          paymentMethod: 'tarjeta',
          creditDueDate: null,
          createdAt: '2024-01-15T10:00:00Z'
        },
        {
          id: 'sale2',
          customerId: 'customer2',
          customerName: 'Juan Gómez',
          customerPhone: '3109876543',
          customerEmail: 'juan.gomez@email.com',
          customerAddress: 'Av 8 #15-30, Medellín',
          date: '2024-01-10',
          items: [
            { productId: 'product3', productName: 'Cargador Rápido 65W USB-C', quantity: 2, sellPrice: 89000, imeisSold: [] }, // MODIFICACIÓN: Añadido imeisSold: []
            { productId: 'product4', productName: 'Funda MagSafe iPhone 15', quantity: 1, sellPrice: 45000, imeisSold: [] } // MODIFICACIÓN: Añadido imeisSold: []
          ],
          imeisSold: [],
          subtotal: (2 * 89000) + 45000,
          taxRate: 19,
          tax: ((2 * 89000) + 45000) * 0.19,
          discount: 0,
          total: ((2 * 89000) + 45000) * 1.19,
          paymentStatus: 'credit',
          paymentMethod: 'otro',
          creditDueDate: '2024-02-10',
          createdAt: '2024-01-10T11:00:00Z'
        },
        {
          id: 'sale3',
          customerId: 'customer3',
          customerName: 'Ana López',
          customerPhone: '3201122334',
          customerEmail: 'ana.lopez@email.com',
          address: 'Carrera 3 #12-45, Cali',
          date: '2024-01-08',
          items: [
            { productId: 'product5', productName: 'AirPods Pro 2da Gen', quantity: 1, sellPrice: 850000, imeisSold: [] } // MODIFICACIÓN: Añadido imeisSold: []
          ],
          imeisSold: [],
          subtotal: 850000,
          taxRate: 19,
          tax: 850000 * 0.19,
          discount: 0,
          total: 850000 * 1.19,
          paymentStatus: 'paid',
          paymentMethod: 'transferencia',
          creditDueDate: null,
          createdAt: '2024-01-08T12:00:00Z'
        },
        {
          id: 'sale4',
          customerId: null, // Consumidor final no tiene ID de cliente
          customerName: 'Consumidor Final',
          customerPhone: '',
          customerEmail: '',
          customerAddress: '',
          date: '2024-01-16',
          items: [
            { productId: 'product1', productName: 'iPhone 15 Pro', quantity: 1, sellPrice: 4200000, imeisSold: ['IMEI-IPH15P-002'] }
          ],
          imeisSold: ['IMEI-IPH15P-002'],
          subtotal: 4200000,
          taxRate: 19,
          tax: 4200000 * 0.19,
          discount: 0,
          total: 4200000 * 1.19,
          paymentStatus: 'paid',
          paymentMethod: 'efectivo',
          creditDueDate: null,
          createdAt: '2024-01-16T13:00:00Z'
        }
      ];

      const expenses = [
        {
          id: 'expense1',
          concept: 'Arriendo Local',
          amount: 1500000,
          category: 'Arriendo',
          date: '2024-01-01',
          description: 'Pago de arriendo mensual',
          createdAt: '2024-01-01T09:00:00Z'
        },
        {
          id: 'expense2',
          concept: 'Factura de Energía',
          amount: 250000,
          category: 'Servicios',
          date: '2024-01-10',
          description: 'Consumo de energía del mes anterior',
          createdAt: '2024-01-10T09:30:00Z'
        },
        {
          id: 'expense3',
          concept: 'Sueldo Empleado 1',
          amount: 1200000,
          category: 'Sueldos',
          date: '2024-01-15',
          description: 'Salario de enero',
          createdAt: '2024-01-15T09:00:00Z'
        },
        {
          id: 'expense4',
          concept: 'Campaña Publicidad Instagram',
          amount: 300000,
          category: 'Publicidad',
          date: '2024-01-20',
          description: 'Campaña de marketing digital',
          createdAt: '2024-01-20T10:00:00Z'
        }
      ];

      const accountsReceivable = [
        {
          id: 'ar1',
          saleId: 'sale2',
          customerId: 'customer2',
          customerName: 'Juan Gómez',
          amount: sales[1].total,
          dueDate: '2024-02-10',
          status: 'pending',
          createdAt: '2024-01-10T11:00:00Z'
        }
      ];

      const accountsPayable = [
        {
          id: 'ap1',
          purchaseId: 'purchase2',
          supplierId: 'supplier2',
          supplierName: 'TecnoImport Ltda',
          amount: purchases[1].total,
          dueDate: '2024-02-05',
          status: 'pending',
          createdAt: '2024-01-05T11:00:00Z'
        }
      ];

      // Usamos storage.set para sobrescribir colecciones completas con los datos de ejemplo.
      await storage.set('suppliers', suppliers);
      await storage.set('products', products);
      await storage.set('customers', customers);
      await storage.set('purchases', purchases);
      await storage.set('sales', sales);
      await storage.set('expenses', expenses);
      await storage.set('accountsReceivable', accountsReceivable);
      await storage.set('accountsPayable', accountsPayable);

      // Guardar configuración inicial
      await storage.set('settings', [{
        id: 'app_settings',
        companyName: 'CeluStore',
        companyNIT: '987654321',
        companyAddress: 'Calle Ficticia 123, Ciudad',
        logoURL: 'https://via.placeholder.com/100x50?text=CeluStore',
        taxRate: 19,
        currency: 'COP',
        theme: 'light',
        minStock: 5
      }]);

      ui.showToast('Datos de ejemplo cargados exitosamente en Firebase');
    }

    // ===== EVENT LISTENERS =====
    document.addEventListener('DOMContentLoaded', async () => {
      await storage.init(); // Inicializa el StorageManager (ahora con Firebase)
      await authManager.init(); // Inicializa el AuthManager y escucha cambios de autenticación

      // Comprobar si necesitamos cargar datos de ejemplo
      // Si la colección 'users' está vacía en Firebase, cargamos los datos de ejemplo.
      const usersCheck = await storage.get('users');
      if (usersCheck.length === 0) {
        await loadSampleData();
      }

      // Login functionality
      document.getElementById('loginButton').addEventListener('click', async () => {
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginError = document.getElementById('loginError');
        loginError.textContent = ''; // Clear previous errors

        await authManager.login(email, password);
      });

      // Register functionality
      document.getElementById('registerButton').addEventListener('click', async () => {
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('roleSelect').value;
        const loginError = document.getElementById('loginError');
        loginError.textContent = ''; // Clear previous errors

        if (!email || !password || !role) {
          loginError.textContent = 'Email, contraseña y rol son obligatorios para el registro.';
          return;
        }

        await authManager.register(email, password, role);
      });

      // Navigation
      document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const tab = e.currentTarget.getAttribute('data-tab');
          if (tab) {
            ui.navigateTo(tab);
          }
        });
      });

      // Logout
      document.getElementById('logoutButton').addEventListener('click', () => {
        ui.confirmAction('¿Estás seguro de que quieres cerrar sesión?', () => {
          authManager.logout();
        });
      });

      // Menu toggle
      document.getElementById('menuToggle').addEventListener('click', () => {
        ui.toggleSidebar();
      });

      // Theme toggle
      document.getElementById('themeToggle').addEventListener('click', () => {
        ui.toggleTheme();
      });

      // Product management
      document.getElementById('btnAddProduct').addEventListener('click', () => productManager.addProduct());
      document.getElementById('btnImportProducts').addEventListener('click', () => productManager.importFromCSV());
      document.getElementById('btnExportProducts').addEventListener('click', () => productManager.exportToCSV());
      document.getElementById('searchProducts').addEventListener('input', (e) => productManager.loadProducts(e.target.value));

      // Delegación de eventos para la tabla de productos
      document.getElementById('productsTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'edit') {
            productManager.editProduct(id);
          } else if (action === 'delete') {
            productManager.deleteProduct(id);
          }
        }
      });

      // Sales management
      document.getElementById('btnNewSale').addEventListener('click', () => saleManager.createSale());
      document.getElementById('searchSales').addEventListener('input', () => saleManager.loadSales());

      // Delegación de eventos para la tabla de ventas
      document.getElementById('salesTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'view') {
            saleManager.viewSale(id);
          } else if (action === 'print') {
            saleManager.printInvoice(id);
          } else if (action === 'delete') {
            saleManager.deleteSale(id);
          }
        }
      });

      // Customer management
      document.getElementById('btnAddCustomer').addEventListener('click', () => customerManager.addCustomer());
      document.getElementById('searchCustomers').addEventListener('input', () => customerManager.loadCustomers());

      // Delegación de eventos para la tabla de clientes
      document.getElementById('customersTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'edit') {
            customerManager.editCustomer(id);
          } else if (action === 'delete') {
            customerManager.deleteCustomer(id);
          }
        }
      });

      // Supplier management
      document.getElementById('btnAddSupplier').addEventListener('click', () => supplierManager.addSupplier());

      // Delegación de eventos para la tabla de proveedores
      document.getElementById('suppliersTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'edit') {
            supplierManager.editSupplier(id);
          } else if (action === 'delete') {
            supplierManager.deleteSupplier(id);
          }
        }
      });

      // Purchase management
      document.getElementById('btnAddPurchase').addEventListener('click', () => purchaseManager.addPurchase());
      document.getElementById('filterPurchaseDate').addEventListener('change', () => purchaseManager.loadPurchases());

      // Delegación de eventos para la tabla de compras
      document.getElementById('purchasesTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'view') {
            purchaseManager.viewPurchase(id);
          }
        }
      });

      // Expense management
      document.getElementById('btnAddExpense').addEventListener('click', () => expenseManager.addExpense());
      document.getElementById('filterExpenseDate').addEventListener('change', () => expenseManager.loadExpenses());
      document.getElementById('filterExpenseCategory').addEventListener('change', () => expenseManager.loadExpenses());

      // Delegación de eventos para la tabla de gastos
      document.getElementById('expensesTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'edit') {
            expenseManager.editExpense(id);
          } else if (action === 'delete') {
            expenseManager.deleteExpense(id);
          }
        }
      });

      // Cash Report
      document.getElementById('cashReportDate').addEventListener('change', () => cashReportManager.loadCashReport());

      // Accounts Receivable management
      document.getElementById('accountsReceivableTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target && target.dataset.action === 'mark-paid') {
          const id = target.dataset.id;
          accountsReceivableManager.markAsPaid(id);
        }
      });

      // Accounts Payable management
      document.getElementById('accountsPayableTable').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target && target.dataset.action === 'mark-paid') {
          const id = target.dataset.id;
          accountsPayableManager.markAsPaid(id);
        }
      });

      // Report management
      document.getElementById('btnGenerateReport').addEventListener('click', () => reportManager.generateReport());
      document.getElementById('btnExportReport').addEventListener('click', () => reportManager.exportReportPDF());
      document.getElementById('btnExportReportCSV').addEventListener('click', () => reportManager.exportReportCSV());

      // Close modal on overlay click
      document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          ui.closeModal();
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        
        if (e.key === 'n' || e.key === 'N') {
          // Como todos los roles tienen acceso a todo, no necesitamos verificar permisos aquí.
          if (ui.activeTab === 'sales') {
            saleManager.createSale();
          } else if (ui.activeTab === 'products') {
            productManager.addProduct();
          } else if (ui.activeTab === 'purchases') {
            purchaseManager.addPurchase();
          } else if (ui.activeTab === 'customers') {
            customerManager.addCustomer();
          } else if (ui.activeTab === 'suppliers') {
            supplierManager.addSupplier();
          } else if (ui.activeTab === 'expenses') {
            expenseManager.addExpense();
          }
        }
        
        if (e.key === 'Escape') {
          ui.closeModal();
        }
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          const sidebar = document.getElementById('sidebar');
          const menuToggle = document.getElementById('menuToggle');
          
          // Check if the sidebar is open and the click is outside both sidebar and menu toggle
          if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            ui.toggleSidebar(false); // Force close
          }
        }
      });

      // Handle window resize
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
          const sidebar = document.getElementById('sidebar');
          sidebar.classList.remove('open'); // Ensure sidebar is not "open" on desktop
          // Re-apply collapsed state if it was collapsed before resize
          if (ui.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            document.getElementById('mainContent').classList.add('expanded');
          } else {
            sidebar.classList.remove('collapsed');
            document.getElementById('mainContent').classList.remove('expanded');
          }
        } else {
          // On mobile, ensure sidebar is collapsed by default unless explicitly opened
          const sidebar = document.getElementById('sidebar');
          const mainContent = document.getElementById('mainContent');
          sidebar.classList.remove('collapsed'); // Remove desktop collapsed state
          mainContent.classList.remove('expanded'); // Remove desktop expanded state
          if (!sidebar.classList.contains('open')) { // If not explicitly open, ensure it's hidden
            sidebar.style.transform = 'translateX(-100%)';
          }
        }
      });
    });
