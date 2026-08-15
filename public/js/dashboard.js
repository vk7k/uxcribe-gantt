// Dashboard, Calendar, Files Repository, and Discuss Views
const DashboardViews = {
  async renderDashboard(projectId) {
    const container = document.getElementById("dashboard-content");
    if (!container) return;

    try {
      const stats = await API.getProjectStats(projectId);

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Top KPI row -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase;">Progreso General</div>
              <div style="font-size:28px; font-weight:700; color:#0284c7; margin-top:6px;">${stats.avgProgress}%</div>
              <div style="height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; margin-top:10px;">
                <div style="height:100%; width:${stats.avgProgress}%; background:#0284c7;"></div>
              </div>
            </div>

            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase;">Completadas</div>
              <div style="font-size:28px; font-weight:700; color:#22c55e; margin-top:6px;">${stats.completed} <span style="font-size:14px; font-weight:500; color:#64748b;">/ ${stats.total}</span></div>
              <div style="font-size:11px; color:#22c55e; margin-top:8px;">✓ Tareas finalizadas</div>
            </div>

            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase;">En Progreso</div>
              <div style="font-size:28px; font-weight:700; color:#f59e0b; margin-top:6px;">${stats.inProgress}</div>
              <div style="font-size:11px; color:#64748b; margin-top:8px;">Tareas en ejecución</div>
            </div>

            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase;">Hitos Clave</div>
              <div style="font-size:28px; font-weight:700; color:#8b5cf6; margin-top:6px;">${stats.milestones}</div>
              <div style="font-size:11px; color:#8b5cf6; margin-top:8px;">◆ Puntos de control</div>
            </div>
          </div>

          <!-- Phases breakdown & Member Workload -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <!-- Phases Progress -->
            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:16px;">Progreso por Fases</div>
              <div style="display:flex; flex-direction:column; gap:14px;">
                ${stats.phases.map(p => `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:6px;">
                      <span style="display:flex; align-items:center; gap:6px;">
                        <span style="width:8px; height:8px; border-radius:2px; background:${p.color || "#0284c7"};"></span>
                        ${p.name}
                      </span>
                      <span>${p.progress}% (${p.tasksCount} tareas)</span>
                    </div>
                    <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                      <div style="height:100%; width:${p.progress}%; background:${p.color || "#0284c7"};"></div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Team Workload -->
            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:16px;">Carga del Equipo</div>
              <div style="display:flex; flex-direction:column; gap:12px;">
                ${Object.entries(stats.workload).map(([name, data]) => {
                  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                  return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border-radius:8px;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:30px; height:30px; border-radius:50%; background:#0284c7; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;">${initials}</div>
                        <div>
                          <div style="font-size:13px; font-weight:600; color:#0f172a;">${name}</div>
                          <div style="font-size:11px; color:#64748b;">${data.total} tareas asignadas</div>
                        </div>
                      </div>
                      <div style="display:flex; gap:6px;">
                        <span style="background:#dcfce7; color:#166534; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px;">${data.completed} listos</span>
                        <span style="background:#fef3c7; color:#92400e; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px;">${data.inProgress} en curso</span>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Error rendering dashboard:", err);
    }
  },

  renderFiles(project) {
    const container = document.getElementById("files-repository-content");
    if (!container) return;

    const allAttachments = [];
    (project.tasks || []).forEach(t => {
      (t.attachments || []).forEach(att => {
        allAttachments.push({ ...att, taskName: t.name, taskId: t.id });
      });
    });

    if (allAttachments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
          <div style="font-size:16px; font-weight:600; color:#0f172a; margin-top:12px;">No hay archivos adjuntos en este proyecto</div>
          <div style="font-size:13px; color:#64748b; margin-top:4px;">Abre una tarea de la carta Gantt y adjunta documentos, diagramas o imágenes.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background:#fff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0; font-size:16px; font-weight:700; color:#0f172a;">
          Repositorio de Archivos del Proyecto (${allAttachments.length})
        </div>
        <div style="padding:16px 20px; display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px;">
          ${allAttachments.map(att => {
            const ext = att.fileName.split(".").pop().toUpperCase();
            const size = att.fileSize > 1024 * 1024 ? (att.fileSize / (1024 * 1024)).toFixed(1) + " MB" : Math.round(att.fileSize / 1024) + " KB";
            return `
              <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px; display:flex; align-items:center; gap:12px; background:#fff;">
                <div style="width:40px; height:40px; border-radius:6px; background:#e0f2fe; color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;">
                  ${ext.slice(0, 4)}
                </div>
                <div style="flex:1; overflow:hidden;">
                  <div style="font-size:13px; font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${att.originalName}">${att.originalName}</div>
                  <div style="font-size:11px; color:#64748b;">${size} • Tarea: ${att.taskName}</div>
                </div>
                <a href="/api/attachments/${att.id}/download" style="padding:6px; background:#f1f5f9; border-radius:4px; color:#0284c7; display:flex;" title="Descargar" download>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  },

  renderDiscuss(project) {
    const container = document.getElementById("discuss-content");
    if (!container) return;

    const allComments = [];
    (project.tasks || []).forEach(t => {
      (t.comments || []).forEach(com => {
        allComments.push({ ...com, taskName: t.name, taskId: t.id });
      });
    });

    allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (allComments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <div style="font-size:16px; font-weight:600; color:#0f172a; margin-top:12px;">No hay comentarios en este proyecto aún</div>
          <div style="font-size:13px; color:#64748b; margin-top:4px;">Los comentarios dejados en las tarjetas de tareas aparecerán en este feed en tiempo real.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:18px; font-weight:700; color:#0f172a;">Feed de Actividad y Discusión del Proyecto</div>
        ${allComments.map(com => {
          const initials = com.authorAvatar || (com.authorName ? com.authorName.slice(0, 2).toUpperCase() : "US");
          const dateFormatted = new Date(com.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
          return `
            <div style="background:#fff; border-radius:12px; border:1px solid #e2e8f0; padding:16px; display:flex; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="width:36px; height:36px; border-radius:50%; background:#4f46e5; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; flex-shrink:0;">
                ${initials}
              </div>
              <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span style="font-size:13px; font-weight:700; color:#0f172a;">${com.authorName}</span>
                    <span style="font-size:12px; color:#64748b; margin-left:8px;">en <a href="javascript:void(0)" onclick="window.TaskModal.open(${com.taskId})" style="color:#0284c7; text-decoration:none; font-weight:600;">${com.taskName}</a></span>
                  </div>
                  <span style="font-size:11px; color:#94a3b8;">${dateFormatted}</span>
                </div>
                <div style="font-size:13px; color:#334155; line-height:1.5; white-space:pre-wrap;">${com.content}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  },

  renderCalendar(project) {
    const container = document.getElementById("calendar-content");
    if (!container) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const tasksInMonth = (project.tasks || []).filter(t => !t.isPhase);

    let daysHtml = "";
    // Empty padding days
    const pad = (firstDay + 6) % 7; // Monday start
    for (let p = 0; p < pad; p++) {
      daysHtml += `<div style="background:#f8fafc; min-height:100px; border:1px solid #e2e8f0; border-radius:6px; opacity:0.4;"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(currentYear, currentMonth, d);
      const isToday = dayDate.toDateString() === now.toDateString();

      const matchingTasks = tasksInMonth.filter(t => {
        const s = new Date(t.startDate);
        const e = new Date(t.endDate);
        s.setHours(0, 0, 0, 0);
        e.setHours(0, 0, 0, 0);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate >= s && dayDate <= e;
      });

      daysHtml += `
        <div style="background:#fff; min-height:100px; border:1px solid #e2e8f0; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:4px; ${isToday ? "border-color:#0284c7; box-shadow:0 0 0 2px rgba(2,132,199,0.2);" : ""}">
          <div style="font-size:12px; font-weight:700; color:${isToday ? "#0284c7" : "#0f172a"};">${d}</div>
          <div style="display:flex; flex-direction:column; gap:3px; overflow:hidden;">
            ${matchingTasks.slice(0, 3).map(t => `
              <div onclick="window.TaskModal.open(${t.id})" style="background:${t.color || "#0284c7"}; color:#fff; font-size:10px; font-weight:600; padding:2px 6px; border-radius:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;" title="${t.name}">
                ${t.name}
              </div>
            `).join("")}
            ${matchingTasks.length > 3 ? `<div style="font-size:9px; color:#64748b; text-align:center;">+${matchingTasks.length - 3} más</div>` : ""}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="background:#fff; border-radius:12px; border:1px solid #e2e8f0; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="font-size:18px; font-weight:700; color:#0f172a; margin-bottom:16px;">
          ${monthNames[currentMonth]} ${currentYear}
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; margin-bottom:8px; font-size:12px; font-weight:700; color:#64748b; text-align:center;">
          <div>LUN</div><div>MAR</div><div>MIÉ</div><div>JUE</div><div>VIE</div><div>SÁB</div><div>DOM</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px;">
          ${daysHtml}
        </div>
      </div>
    `;
  }
};

window.DashboardViews = DashboardViews;
