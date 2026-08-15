// Authentication & User Session Manager with Full Gate Support
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.allUsers = [];
    this.mode = "login";
    this.init();
  }

  async init() {
    this.bindEvents();
    const user = await this.checkSession();

    if (!user) {
      this.showAuthGate();
    } else {
      this.hideAuthGate();
      if (window.App && !window.App.isInitialized) {
        await window.App.initWorkspace();
      }
    }

    await this.loadUsers();
  }

  bindEvents() {
    const tabLogin = document.getElementById("gate-tab-login");
    const tabRegister = document.getElementById("gate-tab-register");
    const form = document.getElementById("form-gate-auth");
    const btnLogout = document.getElementById("btn-logout");

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

  showAuthGate() {
    const gate = document.getElementById("auth-gate-screen");
    const appContainer = document.querySelector(".app-container");
    if (gate) gate.style.display = "flex";
    if (appContainer) appContainer.style.display = "none";
  }

  hideAuthGate() {
    const gate = document.getElementById("auth-gate-screen");
    const appContainer = document.querySelector(".app-container");
    if (gate) gate.style.display = "none";
    if (appContainer) appContainer.style.display = "flex";
  }

  setMode(mode) {
    this.mode = mode;
    const tabLogin = document.getElementById("gate-tab-login");
    const tabRegister = document.getElementById("gate-tab-register");
    const nameField = document.getElementById("gate-field-name");
    const submitBtn = document.getElementById("btn-gate-submit");
    const errorBanner = document.getElementById("gate-auth-error");

    if (errorBanner) errorBanner.style.display = "none";

    if (mode === "login") {
      if (nameField) nameField.style.display = "none";
      if (submitBtn) submitBtn.textContent = "Iniciar Sesión";
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
    } else {
      if (nameField) nameField.style.display = "block";
      if (submitBtn) submitBtn.textContent = "Crear Cuenta y Comenzar";
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
    }
  }

  async checkSession() {
    try {
      this.currentUser = await API.getMe();
      this.renderUserBadge();
      return this.currentUser;
    } catch (e) {
      this.currentUser = null;
      this.renderUserBadge();
      return null;
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
    const badge = document.getElementById("user-profile-badge");
    const nameEl = document.getElementById("user-display-name");
    const avatarEl = document.getElementById("user-avatar-img");

    if (this.currentUser) {
      if (badge) badge.style.display = "flex";
      if (nameEl) nameEl.textContent = this.currentUser.name;
      if (avatarEl) avatarEl.src = this.currentUser.avatarUrl || "";
    } else {
      if (badge) badge.style.display = "none";
    }
  }

  async handleAuthSubmit() {
    const email = document.getElementById("gate-input-email")?.value.trim();
    const password = document.getElementById("gate-input-password")?.value;
    const name = document.getElementById("gate-input-name")?.value.trim();
    const errorBanner = document.getElementById("gate-auth-error");

    if (errorBanner) errorBanner.style.display = "none";

    try {
      let res = null;
      if (this.mode === "login") {
        res = await API.login(email, password);
      } else {
        if (!name) throw new Error("Por favor ingresa tu nombre completo.");
        res = await API.register({ name, email, password });
      }

      this.currentUser = res.user;
      this.renderUserBadge();
      this.hideAuthGate();
      await this.loadUsers();

      if (window.App) {
        await window.App.initWorkspace();
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
    this.showAuthGate();
    if (window.App) {
      window.App.currentProject = null;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.Auth = new AuthManager();
});
