// Authentication & User Session Manager
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.allUsers = [];
    this.mode = "login"; // "login" or "register"
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkSession();
    await this.loadUsers();
  }

  bindEvents() {
    const modal = document.getElementById("modal-auth-overlay");
    const btnOpen = document.getElementById("btn-login-open");
    const btnClose = document.getElementById("btn-close-auth-modal");
    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");
    const btnLogout = document.getElementById("btn-logout");
    const form = document.getElementById("form-auth-submit");

    btnOpen?.addEventListener("click", () => this.openAuthModal("login"));
    btnClose?.addEventListener("click", () => this.closeAuthModal());
    modal?.addEventListener("click", (e) => {
      if (e.target.id === "modal-auth-overlay") this.closeAuthModal();
    });

    tabLogin?.addEventListener("click", () => this.setMode("login"));
    tabRegister?.addEventListener("click", () => this.setMode("register"));

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleAuthSubmit();
    });

    btnLogout?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.logout();
    });
  }

  setMode(mode) {
    this.mode = mode;
    const title = document.getElementById("auth-modal-title");
    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");
    const nameField = document.getElementById("field-auth-name");
    const submitBtn = document.getElementById("btn-auth-action-submit");
    const errorBanner = document.getElementById("auth-error-banner");

    if (errorBanner) errorBanner.style.display = "none";

    if (mode === "login") {
      if (title) title.textContent = "Iniciar Sesión";
      if (nameField) nameField.style.display = "none";
      if (submitBtn) submitBtn.textContent = "Ingresar";
      tabLogin.style.fontWeight = "700";
      tabLogin.style.color = "#0284c7";
      tabLogin.style.borderBottom = "2px solid #0284c7";
      tabRegister.style.fontWeight = "500";
      tabRegister.style.color = "#64748b";
      tabRegister.style.borderBottom = "none";
    } else {
      if (title) title.textContent = "Crear Nueva Cuenta";
      if (nameField) nameField.style.display = "block";
      if (submitBtn) submitBtn.textContent = "Registrarme";
      tabRegister.style.fontWeight = "700";
      tabRegister.style.color = "#0284c7";
      tabRegister.style.borderBottom = "2px solid #0284c7";
      tabLogin.style.fontWeight = "500";
      tabLogin.style.color = "#64748b";
      tabLogin.style.borderBottom = "none";
    }
  }

  openAuthModal(mode = "login") {
    this.setMode(mode);
    const modal = document.getElementById("modal-auth-overlay");
    if (modal) modal.classList.add("active");
  }

  closeAuthModal() {
    const modal = document.getElementById("modal-auth-overlay");
    if (modal) modal.classList.remove("active");
  }

  async checkSession() {
    try {
      this.currentUser = await API.getMe();
      this.renderUserBadge();
    } catch (e) {
      this.currentUser = null;
      this.renderUserBadge();
    }
  }

  async loadUsers() {
    try {
      this.allUsers = await API.getUsers();
      this.populateUsersDatalist();
    } catch (e) {
      this.allUsers = [];
    }
  }

  populateUsersDatalist() {
    const datalist = document.getElementById("registered-users-list");
    if (!datalist) return;
    datalist.innerHTML = "";

    this.allUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.name;
      opt.textContent = `${u.name} (${u.email})`;
      datalist.appendChild(opt);
    });
  }

  renderUserBadge() {
    const btnLogin = document.getElementById("btn-login-open");
    const badge = document.getElementById("user-profile-badge");
    const nameEl = document.getElementById("user-display-name");
    const avatarEl = document.getElementById("user-avatar-img");

    if (this.currentUser) {
      if (btnLogin) btnLogin.style.display = "none";
      if (badge) badge.style.display = "flex";
      if (nameEl) nameEl.textContent = this.currentUser.name.split(" ")[0];
      if (avatarEl) avatarEl.src = this.currentUser.avatarUrl || "";
    } else {
      if (btnLogin) btnLogin.style.display = "flex";
      if (badge) badge.style.display = "none";
    }
  }

  async handleAuthSubmit() {
    const email = document.getElementById("input-auth-email")?.value.trim();
    const password = document.getElementById("input-auth-password")?.value;
    const name = document.getElementById("input-auth-name")?.value.trim();
    const errorBanner = document.getElementById("auth-error-banner");

    if (errorBanner) errorBanner.style.display = "none";

    try {
      if (this.mode === "login") {
        const res = await API.login(email, password);
        this.currentUser = res.user;
      } else {
        if (!name) throw new Error("Por favor ingresa tu nombre completo.");
        const res = await API.register({ name, email, password });
        this.currentUser = res.user;
      }

      this.renderUserBadge();
      this.closeAuthModal();
      await this.loadUsers();

      if (window.App) {
        window.App.showToast(`¡Bienvenido, ${this.currentUser.name}!`, "success");
      }
    } catch (err) {
      if (errorBanner) {
        errorBanner.textContent = err.message || "Error al autenticar.";
        errorBanner.style.display = "block";
      }
    }
  }

  logout() {
    API.logout();
    this.currentUser = null;
    this.renderUserBadge();
    if (window.App) {
      window.App.showToast("Sesión cerrada", "info");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.Auth = new AuthManager();
});
