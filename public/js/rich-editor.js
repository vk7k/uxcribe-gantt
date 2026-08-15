// Lightweight WYSIWYG Rich Text Editor for Task Cards
class RichEditor {
  constructor(editorElement) {
    this.editor = editorElement;
    this.init();
  }

  init() {
    if (!this.editor) return;

    // Toolbar button clicks
    const toolbar = this.editor.closest(".rich-editor-container")?.querySelector(".rich-editor-toolbar");
    if (toolbar) {
      toolbar.querySelectorAll("[data-cmd]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const cmd = btn.getAttribute("data-cmd");
          const val = btn.getAttribute("data-val") || null;
          this.executeCommand(cmd, val);
          this.updateActiveButtons(toolbar);
        });
      });

      // Insert Link
      const linkBtn = toolbar.querySelector("#btn-re-insert-link");
      if (linkBtn) {
        linkBtn.addEventListener("click", () => {
          const url = prompt("Ingrese la URL del enlace (ej: https://ejemplo.com):");
          if (url) {
            this.executeCommand("createLink", url);
          }
        });
      }

      // Insert Image via File Picker
      const imgBtn = toolbar.querySelector("#btn-re-insert-image");
      const imgInput = toolbar.querySelector("#re-inline-image-input");
      if (imgBtn && imgInput) {
        imgBtn.addEventListener("click", () => imgInput.click());
        imgInput.addEventListener("change", async (e) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            await this.uploadAndInsertImage(file);
            imgInput.value = "";
          }
        });
      }
    }

    // Drag & Drop images directly into editor
    this.editor.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.editor.style.background = "#f0f9ff";
    });
    this.editor.addEventListener("dragleave", () => {
      this.editor.style.background = "#ffffff";
    });
    this.editor.addEventListener("drop", async (e) => {
      e.preventDefault();
      this.editor.style.background = "#ffffff";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (const file of e.dataTransfer.files) {
          if (file.type.startsWith("image/")) {
            await this.uploadAndInsertImage(file);
          }
        }
      }
    });

    // Paste images from clipboard
    this.editor.addEventListener("paste", async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf("image") === 0) {
          const blob = item.getAsFile();
          await this.uploadAndInsertImage(blob);
          e.preventDefault();
        }
      }
    });
  }

  executeCommand(cmd, val = null) {
    this.editor.focus();
    document.execCommand(cmd, false, val);
  }

  async uploadAndInsertImage(file) {
    try {
      const res = await API.uploadInlineImage(file);
      if (res && res.url) {
        this.editor.focus();
        document.execCommand("insertImage", false, res.url);
      }
    } catch (err) {
      console.error("Error inserting inline image:", err);
      alert("Error al subir la imagen en el texto.");
    }
  }

  updateActiveButtons(toolbar) {
    toolbar.querySelectorAll("[data-cmd]").forEach(btn => {
      const cmd = btn.getAttribute("data-cmd");
      if (["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].includes(cmd)) {
        if (document.queryCommandState(cmd)) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });
  }

  getHTML() {
    return this.editor.innerHTML;
  }

  setHTML(html) {
    this.editor.innerHTML = html || "";
  }
}

window.RichEditor = RichEditor;
