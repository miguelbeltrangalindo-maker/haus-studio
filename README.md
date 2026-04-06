# HAUS Studio — Sistema de Agenda

App web interna para gestión de sesiones fotográficas.

---

## Paso 1 — Configurar Supabase (base de datos)

1. Ve a https://supabase.com y entra a tu proyecto
2. En el menú izquierdo → **SQL Editor** → **New query**
3. Copia y pega todo el contenido del archivo `schema.sql`
4. Haz clic en **Run**
5. Deberías ver: "Success. No rows returned"

---

## Paso 2 — Subir el código a GitHub

1. Ve a https://github.com y crea un repositorio nuevo
   - Nombre: `haus-studio`
   - Visibilidad: **Private** (recomendado)
   - Sin README, sin .gitignore
2. Descarga el archivo ZIP que te compartí y descomprímelo
3. Abre la carpeta en tu terminal y ejecuta:

```bash
git init
git add .
git commit -m "HAUS Studio v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/haus-studio.git
git push -u origin main
```

---

## Paso 3 — Publicar en Vercel

1. Ve a https://vercel.com → **Add New Project**
2. Importa el repositorio `haus-studio` de tu GitHub
3. En la sección **Environment Variables** agrega:

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://jbtbcftuvlabwgjwxzms.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` (tu clave completa) |

4. Haz clic en **Deploy**
5. En ~2 minutos tendrás una URL tipo `https://haus-studio.vercel.app`

---

## Desarrollo local (opcional)

Si quieres correrla en tu computadora:

```bash
# Instalar dependencias
npm install

# Correr en modo desarrollo
npm run dev

# Abrir en el navegador
# http://localhost:5173
```

---

## Estructura del proyecto

```
haus-studio/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx       # Navegación lateral
│   │   ├── SessionModal.jsx  # Formulario crear/editar sesión
│   │   └── Badge.jsx         # Etiquetas de estatus
│   ├── pages/
│   │   ├── Dashboard.jsx     # Pantalla principal con métricas
│   │   ├── Agenda.jsx        # Calendario día/semana/mes
│   │   ├── Sesiones.jsx      # Lista con búsqueda y filtros
│   │   └── Config.jsx        # Configuración editable
│   ├── hooks/
│   │   ├── useSessions.js    # CRUD completo con Supabase
│   │   ├── useConfig.jsx     # Configuración global
│   │   └── useToast.jsx      # Notificaciones
│   ├── lib/
│   │   ├── supabase.js       # Cliente de base de datos
│   │   └── utils.js          # Funciones auxiliares
│   ├── App.jsx               # Rutas y estado global
│   ├── main.jsx              # Entrada de React
│   └── index.css             # Estilos globales
├── schema.sql                # SQL para crear las tablas
├── .env                      # Variables de entorno (NO subir a GitHub)
└── package.json
```

---

## Funcionalidades incluidas

- Dashboard con 8 métricas en tiempo real
- Agenda con vistas de día, semana y mes
- Bloque de 30 min, sesiones de 20 min
- Prevención de doble reserva automática
- Creación/edición/cancelación de sesiones
- Botón de recordatorio por WhatsApp (mensaje precargado)
- Botón de entrega de fotos por WhatsApp (con link)
- Trazabilidad: recordatorio enviado / fotos enviadas
- Búsqueda por nombre, teléfono, fecha, estatus
- Filtros rápidos por día/mañana/pendientes/entregadas
- Configuración editable sin tocar código
- Diseño responsivo (desktop y móvil)

---

## Segunda fase (futuro)

- Login con usuarios y roles (admin / recepción)
- Portal para clientes
- Notificaciones automáticas
- Pagos integrados
- Reportes exportables
