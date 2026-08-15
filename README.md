# uxcribe-gantt 📊

Aplicación web colaborativa de Carta Gantt con interfaz inspirada en ProjectManager.com y tarjetas de tareas estilo Trello con editor de texto enriquecido (WYSIWYG), subida de imágenes inline, feed de comentarios en tiempo real, archivos adjuntos, checklists y dependencias.

---

## 🚀 Características Principales

1. **Carta Gantt Colaborativa e Interactiva**:
   - **Split Pane**: Tabla jerárquica a la izquierda con fases expandibles/colapsables, números de fila, checkbox de completado, fechas, asignados y progreso.
   - **Timeline Gantt**: Arrastrar y soltar para mover fechas, redimensionar duración en los extremos, barras de resumen de fase con progreso acumulado, diamantes de hitos (milestones) y flechas vectoriales SVG para dependencias.
   - **Controles de Zoom**: Días, Semanas y Meses.
   - **Múltiples Proyectos**: Pestañas superiores para alternar rápidamente entre proyectos o crear nuevos.
   - **Vistas Especiales**: Carta Gantt, Dashboard con métricas y KPIs, Calendario mensual, Repositorio de Archivos y Feed general de Discusión.

2. **Tarjeta de Tarea Tipo Trello**:
   - **Editor de Texto Enriquecido**: Formato de texto (negrita, cursiva, encabezados H2/H3, listas, citas, enlaces) e **inserción directa de imágenes** mediante botón, selector de archivos o arrastrando imágenes directamente al editor.
   - **Feed de Comentarios en Vivo**: Registro cronológico de comentarios con autor, avatar con iniciales, fecha y eliminación.
   - **Archivos Adjuntos**: Subida de archivos con drag & drop, tarjetas de archivo con tamaño y fecha, botones de descarga directa y eliminación.
   - **Checklists**: Lista de subtareas con barra de progreso porcentual y tachado automático al completar.
   - **Gestión de Fechas y Progreso**: Selectores de fecha inicio/fin, slider interactivo de porcentaje de avance (0-100%) y paleta de colores.
   - **Etiquetas y Asignados**: Chips de etiquetas interactivas y selector de miembros del equipo.
   - **Gestión de Dependencias**: Configuración de predecesoras y sucesoras con dropdown de selección.

3. **Arquitectura y Backend**:
   - **Node.js + Express**: Servidor HTTP y API REST.
   - **Prisma ORM**: Modelado relacional con MySQL (`uxcribe_gantt`), migraciones automáticas y seed de datos de demostración.
   - **Socket.IO**: Sincronización colaborativa en tiempo real entre múltiples usuarios conectados.
   - **Multer**: Subida y servicio de archivos adjuntos e imágenes en la carpeta `./uploads/`.

---

## 🛠️ Requisitos Previos

- **Node.js** v18+ o v20+ / v22+
- **MySQL Server** (por defecto corriendo en `localhost:3306`)

---

## 📦 Instalación y Puesta en Marcha

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configuración de variables de entorno**:
   Copia el archivo `.env.example` a `.env` y ajusta tus credenciales de MySQL:
   ```env
   PORT=3001
   DATABASE_URL="mysql://root:@localhost:3306/uxcribe_gantt"
   NODE_ENV=development
   ```

3. **Crear y poblar la Base de Datos**:
   ```bash
   # Aplica el esquema Prisma a MySQL y genera el cliente
   npx prisma db push

   # Poblar con datos de prueba realistas (fases, tareas, comentarios, checklists)
   npm run prisma:seed
   ```

4. **Iniciar el Servidor**:
   ```bash
   npm start
   ```
   Abre tu navegador en: [http://localhost:3001](http://localhost:3001)

---

## 📁 Estructura del Código

```
uxcribe-gantt/
├── .env                      # Variables de entorno activas
├── .env.example              # Plantilla de variables de entorno
├── package.json              # Dependencias y scripts npm
├── prisma/
│   ├── schema.prisma         # Esquema de base de datos relacional Prisma (MySQL)
│   └── seed.js               # Script para poblar la BD con el proyecto de muestra
├── server/
│   ├── config.js             # Configuración del servidor y paths
│   ├── db.js                 # Cliente Prisma ORM
│   ├── socket.js             # Gestor de eventos en tiempo real con Socket.IO
│   ├── routes/
│   │   ├── projects.js       # Endpoints de proyectos y estadísticas
│   │   ├── tasks.js          # Endpoints de tareas y jerarquía
│   │   ├── comments.js       # Endpoints para comentarios
│   │   ├── attachments.js    # Subida, descarga y borrado de archivos adjuntos
│   │   ├── checklists.js     # Endpoints de ítems de checklist
│   │   ├── dependencies.js   # Gestión de dependencias entre tareas
│   │   └── upload.js         # Subida de imágenes inline para el editor enriquecido
│   └── index.js              # Punto de entrada de la aplicación Express
├── uploads/                  # Directorio de almacenamiento de archivos subidos
└── public/
    ├── index.html            # Interfaz principal (Navbar, Gantt, Modales, Vistas)
    ├── css/
    │   ├── variables.css     # Paleta de colores, medidas y tipografía Inter
    │   ├── layout.css        # Navegación superior, pestañas y toolbar
    │   ├── gantt.css         # Grid jerárquico, timeline y barras de Gantt
    │   ├── modal-card.css    # Tarjeta de tarea interactiva estilo Trello
    │   ├── rich-editor.css   # Estilos del editor WYSIWYG
    │   └── components.css    # Modales, botones, badges y toasts
    └── js/
        ├── api.js            # Cliente HTTP para endpoints REST
        ├── socket.js         # Capa de sincronización Socket.IO en vivo
        ├── rich-editor.js    # Editor WYSIWYG con inserción de imágenes
        ├── gantt-grid.js     # Tabla izquierda de la carta Gantt
        ├── gantt-timeline.js # Motor del timeline derecho (drag, resize, SVG)
        ├── task-modal.js     # Controlador del modal de tarea
        ├── dashboard.js      # Vistas de Dashboard, Calendario, Archivos y Feed
        └── app.js            # Inicialización global y gestión de proyectos
```
