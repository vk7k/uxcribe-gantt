const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Seeding database uxcribe_gantt...");

  // Clear existing
  await prisma.taskLink.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();

  // Create sample projects
  const sampleProject = await prisma.project.create({
    data: {
      name: "Sample Project",
      description: "Proyecto de implementación y desarrollo de software empresarial",
      color: "#0284c7"
    }
  });

  const foresterProject = await prisma.project.create({
    data: {
      name: "Forester Construction",
      description: "Plan de construcción y remodelación de sede central",
      color: "#16a34a"
    }
  });

  const grandPrixProject = await prisma.project.create({
    data: {
      name: "2027 Grand Prix Architecture",
      description: "Diseño de infraestructura para evento internacional",
      color: "#ea580c"
    }
  });

  // Ensure sample uploads exist
  const uploadsDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Create dummy sample attachment files if not exist
  const samplePdfPath = path.join(uploadsDir, "especificaciones_analisis.pdf");
  if (!fs.existsSync(samplePdfPath)) {
    fs.writeFileSync(samplePdfPath, "%PDF-1.4 Mock analysis specification document for uxcribe-gantt");
  }
  const sampleDocPath = path.join(uploadsDir, "arquitectura_sistema.docx");
  if (!fs.existsSync(sampleDocPath)) {
    fs.writeFileSync(sampleDocPath, "Mock architecture doc for uxcribe-gantt");
  }

  // Tasks for Sample Project
  // 1. Analysis Phase
  const p1 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      name: "1. Analysis",
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-11-10T00:00:00Z"),
      progress: 89,
      color: "#64748b",
      isPhase: true,
      orderIndex: 1,
      description: "<h3>Fase de Análisis de Requerimientos</h3><p>Revisión exhaustiva de procesos de negocio, entrevistas con usuarios clave y levantamiento de especificaciones técnicas.</p>",
      tags: "fase,analisis,core"
    }
  });

  const t1_1 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p1.id,
      name: "On-Site Meetings",
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-11-04T00:00:00Z"),
      progress: 100,
      color: "#64748b",
      assignedTo: "Mike Smith",
      orderIndex: 2,
      tags: "reunion,stakeholders",
      description: "<p>Reuniones presenciales con líderes de departamento para definir alcance general.</p>",
      notes: "Actas firmadas por gerencia."
    }
  });

  const t1_2 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p1.id,
      name: "Discussions with Stakeholders",
      startDate: new Date("2026-11-07T00:00:00Z"),
      endDate: new Date("2026-11-08T00:00:00Z"),
      progress: 59,
      color: "#64748b",
      assignedTo: "Mike Smith",
      orderIndex: 3,
      tags: "stakeholders,ux",
      description: "<p>Sesiones de discusión sobre requerimientos no funcionales y SLAs.</p>"
    }
  });

  const t1_3 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p1.id,
      name: "Document Current System",
      startDate: new Date("2026-11-09T00:00:00Z"),
      endDate: new Date("2026-11-10T00:00:00Z"),
      progress: 100,
      color: "#64748b",
      assignedTo: "Mike Smith",
      orderIndex: 4,
      tags: "documentacion",
      description: "<h3>Documentación del Sistema Actual</h3><p>Mapeo de arquitectura legacy y flujos de datos existentes.</p>"
    }
  });

  const t1_4 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p1.id,
      name: "Analysis Complete",
      startDate: new Date("2026-11-10T00:00:00Z"),
      endDate: new Date("2026-11-10T00:00:00Z"),
      progress: 100,
      color: "#0ea5e9",
      isMilestone: true,
      assignedTo: "Jennifer Jones",
      orderIndex: 5,
      tags: "hito,aprobacion",
      description: "<p><strong>Hito de cierre de la fase de análisis.</strong> Aprobación final entregada por el comité de proyectos.</p>"
    }
  });

  // 2. Design Phase
  const p2 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      name: "2. Design",
      startDate: new Date("2026-11-10T00:00:00Z"),
      endDate: new Date("2026-12-02T00:00:00Z"),
      progress: 73,
      color: "#0284c7",
      isPhase: true,
      orderIndex: 6,
      tags: "fase,diseño,ui-ux",
      description: "<h3>Fase de Diseño</h3><p>Modelado de datos, diagramas UML, interfaces de usuario y especificación de servicios REST/WebSockets.</p>"
    }
  });

  const t2_1 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p2.id,
      name: "Design Database",
      startDate: new Date("2026-11-10T00:00:00Z"),
      endDate: new Date("2026-11-16T00:00:00Z"),
      progress: 100,
      color: "#0284c7",
      assignedTo: "Jennifer Jones",
      orderIndex: 7,
      tags: "database,mysql,prisma",
      description: "<p>Diseño del modelo entidad-relación en MySQL con soporte para relaciones jerárquicas y dependencias.</p>"
    }
  });

  const t2_2 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p2.id,
      name: "Software Design",
      startDate: new Date("2026-11-16T00:00:00Z"),
      endDate: new Date("2026-11-23T00:00:00Z"),
      progress: 55,
      color: "#0284c7",
      assignedTo: "Jennifer Jones",
      orderIndex: 8,
      tags: "arquitectura,backend",
      description: "<p>Diseño de controladores, middleware de autenticación y capas de servicio.</p>"
    }
  });

  const t2_3 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p2.id,
      name: "Interface Design",
      startDate: new Date("2026-11-23T00:00:00Z"),
      endDate: new Date("2026-11-25T00:00:00Z"),
      progress: 100,
      color: "#0284c7",
      assignedTo: "Jennifer Jones",
      orderIndex: 9,
      tags: "ui,figma,css",
      description: "<h3>Diseño de Interfaces</h3><p>Creación de vistas responsivas, tarjeta de tarea modal interactiva y diagramas Gantt con SVG interactivo.</p>"
    }
  });

  const t2_4 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p2.id,
      name: "Create Design Specification",
      startDate: new Date("2026-11-25T00:00:00Z"),
      endDate: new Date("2026-12-02T00:00:00Z"),
      progress: 37,
      color: "#0284c7",
      assignedTo: "Jennifer Jones",
      orderIndex: 10,
      tags: "especificaciones",
      description: "<p>Redacción del documento técnico final con directrices para el equipo de desarrollo.</p>"
    }
  });

  const t2_5 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p2.id,
      name: "Design Complete",
      startDate: new Date("2026-12-02T00:00:00Z"),
      endDate: new Date("2026-12-02T00:00:00Z"),
      progress: 0,
      color: "#0284c7",
      isMilestone: true,
      assignedTo: "Mike Smith",
      orderIndex: 11,
      tags: "hito",
      description: "<p>Hito de aprobación del diseño completo del sistema.</p>"
    }
  });

  // 3. Development Phase
  const p3 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      name: "3. Development",
      startDate: new Date("2026-11-10T00:00:00Z"),
      endDate: new Date("2026-12-09T00:00:00Z"),
      progress: 43,
      color: "#22c55e",
      isPhase: true,
      orderIndex: 12,
      tags: "fase,desarrollo,codigo",
      description: "<h3>Fase de Desarrollo y Programación</h3><p>Construcción de módulos centrales, componentes visuales y pasarela de sincronización WebSocket.</p>"
    }
  });

  const t3_1 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p3.id,
      name: "Develop System Modules",
      startDate: new Date("2026-11-10T00:00:00Z"),
      endDate: new Date("2026-11-25T00:00:00Z"),
      progress: 51,
      color: "#22c55e",
      assignedTo: "Sam Watson",
      orderIndex: 13,
      tags: "backend,api,socket",
      description: "<h3>Desarrollo de Módulos del Sistema</h3><p>Implementación de endpoints REST, ORM Prisma y eventos de Socket.IO para sincronización instantánea.</p>"
    }
  });

  const t3_2 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p3.id,
      name: "Integrate System Modules",
      startDate: new Date("2026-11-25T00:00:00Z"),
      endDate: new Date("2026-12-06T00:00:00Z"),
      progress: 36,
      color: "#22c55e",
      assignedTo: "Sam Watson",
      orderIndex: 14,
      tags: "integracion,frontend",
      description: "<p>Integración del frontend interactivo con el API de tareas, comentarios y archivos adjuntos.</p>"
    }
  });

  const t3_3 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p3.id,
      name: "Perform Initial Testing",
      startDate: new Date("2026-12-06T00:00:00Z"),
      endDate: new Date("2026-12-09T00:00:00Z"),
      progress: 0,
      color: "#22c55e",
      assignedTo: "Sam Watson",
      orderIndex: 15,
      tags: "testing,qa",
      description: "<p>Pruebas de humo y unitarias para verificar estabilidad de servicios.</p>"
    }
  });

  const t3_4 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p3.id,
      name: "Development Complete",
      startDate: new Date("2026-12-09T00:00:00Z"),
      endDate: new Date("2026-12-09T00:00:00Z"),
      progress: 0,
      color: "#22c55e",
      isMilestone: true,
      assignedTo: "Mike Smith",
      orderIndex: 16,
      tags: "hito",
      description: "<p>Cierre formal de la etapa de desarrollo de software.</p>"
    }
  });

  // 4. Testing Phase
  const p4 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      name: "4. Testing",
      startDate: new Date("2026-11-25T00:00:00Z"),
      endDate: new Date("2026-12-20T00:00:00Z"),
      progress: 15,
      color: "#6366f1",
      isPhase: true,
      orderIndex: 17,
      tags: "fase,qa,testing",
      description: "<h3>Fase de Control de Calidad</h3><p>Ejecución de pruebas funcionales, rendimiento y corrección de bugs.</p>"
    }
  });

  const t4_1 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p4.id,
      name: "Perform System Testing",
      startDate: new Date("2026-11-25T00:00:00Z"),
      endDate: new Date("2026-12-07T00:00:00Z"),
      progress: 30,
      color: "#6366f1",
      assignedTo: "Mike Smith",
      orderIndex: 18,
      tags: "qa,testing",
      description: "<p>Pruebas end-to-end de creación de tareas, movimiento en carta Gantt y concurrencia multiusuario.</p>"
    }
  });

  const t4_2 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p4.id,
      name: "Document Issues Found",
      startDate: new Date("2026-12-07T00:00:00Z"),
      endDate: new Date("2026-12-15T00:00:00Z"),
      progress: 0,
      color: "#6366f1",
      assignedTo: "Mike Smith",
      orderIndex: 19,
      tags: "bugs,triage",
      description: "<p>Registro de incidencias detectadas en la matriz de pruebas.</p>"
    }
  });

  const t4_3 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p4.id,
      name: "Correct Issues Found",
      startDate: new Date("2026-12-15T00:00:00Z"),
      endDate: new Date("2026-12-20T00:00:00Z"),
      progress: 0,
      color: "#6366f1",
      assignedTo: "Mike Smith",
      orderIndex: 20,
      tags: "hotfix,refactor",
      description: "<p>Resolución y refactorización de los casos reportados.</p>"
    }
  });

  const t4_4 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p4.id,
      name: "Testing Complete",
      startDate: new Date("2026-12-20T00:00:00Z"),
      endDate: new Date("2026-12-20T00:00:00Z"),
      progress: 0,
      color: "#6366f1",
      isMilestone: true,
      assignedTo: "Sam Watson",
      orderIndex: 21,
      tags: "hito",
      description: "<p>Certificación de calidad aprobada para pase a producción.</p>"
    }
  });

  // 5. Implementation Phase
  const p5 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      name: "5. Implementation",
      startDate: new Date("2026-12-20T00:00:00Z"),
      endDate: new Date("2027-01-10T00:00:00Z"),
      progress: 0,
      color: "#64748b",
      isPhase: true,
      orderIndex: 22,
      tags: "fase,despliegue",
      description: "<h3>Fase de Despliegue e Instalación</h3><p>Puesta en marcha en infraestructura de producción y migración de datos reales.</p>"
    }
  });

  const t5_1 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p5.id,
      name: "On-Site Installation",
      startDate: new Date("2026-12-20T00:00:00Z"),
      endDate: new Date("2026-12-26T00:00:00Z"),
      progress: 0,
      color: "#64748b",
      assignedTo: "Jennifer Jones",
      orderIndex: 23,
      tags: "devops,infra",
      description: "<p>Configuración de servidores de producción y balanceadores de carga.</p>"
    }
  });

  const t5_2 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p5.id,
      name: "Setup Database",
      startDate: new Date("2026-12-26T00:00:00Z"),
      endDate: new Date("2026-12-29T00:00:00Z"),
      progress: 0,
      color: "#64748b",
      assignedTo: "Jennifer Jones",
      orderIndex: 24,
      tags: "database,mysql",
      description: "<p>Instalación del clúster de base de datos MySQL con réplicas de solo lectura.</p>"
    }
  });

  const t5_3 = await prisma.task.create({
    data: {
      projectId: sampleProject.id,
      parentId: p5.id,
      name: "Import Live Data",
      startDate: new Date("2026-12-29T00:00:00Z"),
      endDate: new Date("2027-01-05T00:00:00Z"),
      progress: 0,
      color: "#64748b",
      assignedTo: "Jennifer Jones",
      orderIndex: 25,
      tags: "migracion,datos",
      description: "<p>Importación y validación de registros históricos.</p>"
    }
  });

  // Dependencies (Finish to Start)
  await prisma.dependency.createMany({
    data: [
      { predecessorId: t1_1.id, successorId: t1_2.id, type: "FS" },
      { predecessorId: t1_2.id, successorId: t1_3.id, type: "FS" },
      { predecessorId: t1_3.id, successorId: t1_4.id, type: "FS" },
      { predecessorId: t1_4.id, successorId: t2_1.id, type: "FS" },
      { predecessorId: t2_1.id, successorId: t2_2.id, type: "FS" },
      { predecessorId: t2_2.id, successorId: t2_3.id, type: "FS" },
      { predecessorId: t2_3.id, successorId: t2_4.id, type: "FS" },
      { predecessorId: t2_4.id, successorId: t2_5.id, type: "FS" },
      { predecessorId: t2_1.id, successorId: t3_1.id, type: "FS" },
      { predecessorId: t3_1.id, successorId: t3_2.id, type: "FS" },
      { predecessorId: t3_2.id, successorId: t3_3.id, type: "FS" },
      { predecessorId: t3_3.id, successorId: t3_4.id, type: "FS" },
      { predecessorId: t3_1.id, successorId: t4_1.id, type: "FS" },
      { predecessorId: t4_1.id, successorId: t4_2.id, type: "FS" },
      { predecessorId: t4_2.id, successorId: t4_3.id, type: "FS" },
      { predecessorId: t4_3.id, successorId: t4_4.id, type: "FS" },
      { predecessorId: t4_4.id, successorId: t5_1.id, type: "FS" },
      { predecessorId: t5_1.id, successorId: t5_2.id, type: "FS" },
      { predecessorId: t5_2.id, successorId: t5_3.id, type: "FS" }
    ]
  });

  // Comments for t1_1 (On-Site Meetings)
  await prisma.comment.createMany({
    data: [
      {
        taskId: t1_1.id,
        authorName: "Mike Smith",
        authorAvatar: "MS",
        content: "Se completaron las 3 sesiones iniciales con el equipo directivo. Todos los objetivos fueron alineados.",
        createdAt: new Date("2026-11-03T14:30:00Z")
      },
      {
        taskId: t1_1.id,
        authorName: "Jennifer Jones",
        authorAvatar: "JJ",
        content: "Excelente trabajo Mike. Ya revisé la minuta y pasamos a la siguiente etapa de discusión con stakeholders.",
        createdAt: new Date("2026-11-04T09:15:00Z")
      }
    ]
  });

  // Comments for t2_1 (Design Database)
  await prisma.comment.createMany({
    data: [
      {
        taskId: t2_1.id,
        authorName: "Jennifer Jones",
        authorAvatar: "JJ",
        content: "El esquema relacional con soporte para jerarquía recursiva y dependencias M:N quedó listo en Prisma.",
        createdAt: new Date("2026-11-14T11:00:00Z")
      },
      {
        taskId: t2_1.id,
        authorName: "Sam Watson",
        authorAvatar: "SW",
        content: "¡Perfecto! Ya estoy consumiendo los modelos generados en los endpoints del servidor.",
        createdAt: new Date("2026-11-15T16:20:00Z")
      }
    ]
  });

  // Checklists for t2_1
  await prisma.checklistItem.createMany({
    data: [
      { taskId: t2_1.id, text: "Definir entidad Project y Task jerárquica", completed: true, orderIndex: 1 },
      { taskId: t2_1.id, text: "Crear tabla de dependencias con llaves foráneas", completed: true, orderIndex: 2 },
      { taskId: t2_1.id, text: "Integrar modelos de Comentarios, Checklists y Attachments", completed: true, orderIndex: 3 },
      { taskId: t2_1.id, text: "Validar índices de rendimiento para consultas concurrentes", completed: true, orderIndex: 4 }
    ]
  });

  // Checklists for t3_1
  await prisma.checklistItem.createMany({
    data: [
      { taskId: t3_1.id, text: "Configurar servidor Express y middleware CORS", completed: true, orderIndex: 1 },
      { taskId: t3_1.id, text: "Implementar Socket.IO para sincronización en tiempo real", completed: true, orderIndex: 2 },
      { taskId: t3_1.id, text: "Rutas REST completas para tareas, proyectos y comentarios", completed: true, orderIndex: 3 },
      { taskId: t3_1.id, text: "Soporte de subida de archivos adjuntos e imágenes inline", completed: false, orderIndex: 4 }
    ]
  });

  // Attachments for t1_1 & t2_1
  await prisma.attachment.create({
    data: {
      taskId: t1_1.id,
      fileName: "especificaciones_analisis.pdf",
      originalName: "Especificaciones_Iniciales_Analisis.pdf",
      fileSize: 45200,
      mimeType: "application/pdf",
      filePath: "/uploads/especificaciones_analisis.pdf"
    }
  });

  await prisma.attachment.create({
    data: {
      taskId: t2_1.id,
      fileName: "arquitectura_sistema.docx",
      originalName: "Arquitectura_de_Base_de_Datos.docx",
      fileSize: 28400,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filePath: "/uploads/arquitectura_sistema.docx"
    }
  });

  // Links for t2_1
  await prisma.taskLink.create({
    data: {
      taskId: t2_1.id,
      title: "Diagrama en Figma",
      url: "https://figma.com/@uxcribe/gantt-model"
    }
  });

  console.log("Database seeded successfully with 25 tasks, 5 phases, dependencies, comments, checklists and attachments!");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = main;
