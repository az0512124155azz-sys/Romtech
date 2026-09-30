(() => {
  "use strict";

  const PASSWORD_KEY = "rt_admin_password";
  const SESSION_KEY = "rt_admin_ok";
  let stagedImages = [];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function money(value) {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function getProducts() {
    return window.RomTechData ? RomTechData.loadProducts() : [];
  }

  function saveProducts(items) {
    if (!window.RomTechData) throw new Error("RomTechData is not loaded");
    RomTechData.saveProducts(items);
    renderAll();
  }

  function encodePassword(value) {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch {
      return value;
    }
  }

  async function sha256(value) {
    if (!window.crypto || !crypto.subtle) return "";
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2, "0")).join("");
  }

  function passwordState() {
    return localStorage.getItem(PASSWORD_KEY) || localStorage.getItem("rt_admin_password_hash") || "";
  }

  function refreshGate() {
    const saved = passwordState();
    const text = $("#adminGateText");
    const reset = $("#resetLocalPassword");
    if (text) {
      text.textContent = saved
        ? "הזן את קוד המנהל שהגדרת בדפדפן הזה."
        : "בכניסה הראשונה הקוד שתקליד יהפוך לקוד המנהל בדפדפן הזה.";
    }
    if (reset) reset.hidden = !saved;
  }

  function showAdmin() {
    const gate = $("#adminGate");
    const app = $("#adminApp");
    if (gate) {
      gate.hidden = true;
      gate.style.display = "none";
    }
    if (app) {
      app.hidden = false;
      app.style.display = "grid";
    }
    renderAll();
  }

  function showGate() {
    const gate = $("#adminGate");
    const app = $("#adminApp");
    if (app) {
      app.hidden = true;
      app.style.display = "none";
    }
    if (gate) {
      gate.hidden = false;
      gate.style.display = "grid";
    }
    refreshGate();
    setTimeout(() => $("#adminCode")?.focus(), 0);
  }

  async function enterAdmin() {
    const input = $("#adminCode");
    const error = $("#loginError");
    if (!input || !error) return;

    const password = input.value.trim();
    error.hidden = true;

    if (password.length < 4) {
      error.textContent = "הקוד חייב להכיל לפחות 4 תווים.";
      error.hidden = false;
      return;
    }

    const savedNew = localStorage.getItem(PASSWORD_KEY);
    const savedOld = localStorage.getItem("rt_admin_password_hash");

    if (!savedNew && !savedOld) {
      localStorage.setItem(PASSWORD_KEY, encodePassword(password));
      sessionStorage.setItem(SESSION_KEY, "1");
      showAdmin();
      return;
    }

    let valid = false;
    if (savedNew) valid = encodePassword(password) === savedNew;

    if (!valid && savedOld) {
      if (/^[a-f0-9]{64}$/i.test(savedOld)) {
        valid = (await sha256(password)) === savedOld;
      } else {
        valid = encodePassword(password) === savedOld;
      }
    }

    if (!valid) {
      error.textContent = "הקוד שגוי.";
      error.hidden = false;
      input.select();
      return;
    }

    if (!savedNew) {
      localStorage.setItem(PASSWORD_KEY, encodePassword(password));
      localStorage.removeItem("rt_admin_password_hash");
    }

    sessionStorage.setItem(SESSION_KEY, "1");
    showAdmin();
  }

  function resetPassword() {
    if (!confirm("לאפס את קוד הניהול השמור בדפדפן הזה?")) return;
    localStorage.removeItem(PASSWORD_KEY);
    localStorage.removeItem("rt_admin_password_hash");
    sessionStorage.removeItem(SESSION_KEY);
    if ($("#adminCode")) $("#adminCode").value = "";
    showGate();
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    showGate();
  }

  const moduleTitles = {
    dashboard: "Dashboard",
    orders: "הזמנות",
    products: "מוצרים",
    inventory: "מלאי",
    customers: "לקוחות",
    content: "תוכן",
    marketing: "שיווק",
    reviews: "ביקורות",
    support: "תמיכה",
    reports: "דוחות",
    settings: "הגדרות"
  };

  function goToModule(name) {
    $$(".admin-module").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
    $$(".side-link[data-module]").forEach((button) => button.classList.toggle("active", button.dataset.module === name));
    const title = $("#moduleTitle");
    if (title) title.textContent = moduleTitles[name] || name;
    if (name === "inventory") renderInventory();
    if (name === "reports") renderReports();
  }

  function renderProducts() {
    const root = $("#adminRows");
    if (!root) return;
    const rows = getProducts();

    root.innerHTML = rows.map((p) => {
      const image = p.images && p.images[0]
        ? '<img class="admin-thumb" src="' + p.images[0] + '" alt="">'
        : '<div class="admin-thumb empty"></div>';

      const low = Number(p.stock || 0) <= Number(p.lowStock || 3)
        ? ' <span class="tag">נמוך</span>'
        : "";

      return '<tr data-id="' + escapeHtml(p.id) + '">' +
        '<td><input type="checkbox" class="pick" value="' + escapeHtml(p.id) + '"></td>' +
        '<td>' + image + '</td>' +
        '<td>' + escapeHtml(p.name) + '</td>' +
        '<td>' + escapeHtml(p.category) + '</td>' +
        '<td>' + money(p.salePrice || p.price) + '</td>' +
        '<td>' + Number(p.stock || 0) + low + '</td>' +
        '<td>' + escapeHtml(p.status || "") + '</td>' +
        '<td class="row-actions">' +
          '<button type="button" data-row-action="edit" data-id="' + escapeHtml(p.id) + '">עריכה</button>' +
          '<button type="button" data-row-action="duplicate" data-id="' + escapeHtml(p.id) + '">שכפול</button>' +
          '<button type="button" data-row-action="delete" data-id="' + escapeHtml(p.id) + '">מחיקה</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  }

  function renderStats() {
    const rows = getProducts();
    if ($("#count")) $("#count").textContent = rows.length;
    if ($("#low")) $("#low").textContent = rows.filter((p) => Number(p.stock || 0) <= Number(p.lowStock || 3)).length;
    if ($("#publishedCount")) $("#publishedCount").textContent = rows.filter((p) => p.status === "published").length;
  }

  function renderInventory() {
    const root = $("#inventoryList");
    if (!root) return;
    const rows = [...getProducts()].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    root.innerHTML = rows.map((p) => {
      const low = Number(p.stock || 0) <= Number(p.lowStock || 3);
      return '<div class="admin-action-card">' +
        '<b>' + escapeHtml(p.name) + '</b>' +
        '<span>מלאי: ' + Number(p.stock || 0) + '</span>' +
        '<span>' + (low ? "⚠ מלאי נמוך" : "תקין") + '</span>' +
      '</div>';
    }).join("") || '<div class="empty-state">אין מוצרים.</div>';
  }

  function renderReports() {
    const root = $("#reportCards");
    if (!root) return;
    const rows = getProducts();
    const inventoryValue = rows.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.cost || 0), 0);
    const units = rows.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const drafts = rows.filter((p) => p.status === "draft").length;

    root.innerHTML =
      '<div class="card card-body"><div class="small">שווי מלאי לפי עלות</div><div class="price">' + money(inventoryValue) + '</div></div>' +
      '<div class="card card-body"><div class="small">יחידות במלאי</div><div class="price">' + units + '</div></div>' +
      '<div class="card card-body"><div class="small">טיוטות</div><div class="price">' + drafts + '</div></div>';
  }

  function renderAll() {
    renderProducts();
    renderStats();
    renderInventory();
    renderReports();
  }

  function openProductModal(product = null) {
    const modal = $("#productModal");
    const form = $("#productForm");
    if (!modal || !form) return;

    form.reset();
    $("#pid").value = "";
    stagedImages = [];

    if (product) {
      $("#modalTitle").textContent = "עריכת מוצר";
      Object.entries(product).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else if (Array.isArray(value)) field.value = value.join(", ");
        else field.value = value ?? "";
      });
      $("#pid").value = product.id;
      stagedImages = Array.isArray(product.images) ? [...product.images] : [];
    } else {
      $("#modalTitle").textContent = "הוסף שטריימל חדש";
    }

    renderImagePreview();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeProductModal() {
    const modal = $("#productModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function renderImagePreview() {
    const root = $("#imagePreview");
    if (!root) return;
    root.innerHTML = stagedImages.map((src, index) =>
      '<div class="preview-item">' +
        '<img src="' + src + '" alt="תצוגה מקדימה">' +
        '<button type="button" data-remove-image="' + index + '" aria-label="הסר תמונה">✕</button>' +
      '</div>'
    ).join("");
  }

  function editProduct(id) {
    const product = getProducts().find((p) => p.id === id);
    if (product) openProductModal(product);
  }

  function duplicateProduct(id) {
    const product = getProducts().find((p) => p.id === id);
    if (!product) return;
    const copy = {
      ...product,
      id: "rt-" + Date.now(),
      name: product.name + " — עותק",
      sku: "",
      slug: "",
      status: "draft",
      images: Array.isArray(product.images) ? [...product.images] : []
    };
    saveProducts([...getProducts(), copy]);
  }

  function deleteProduct(id) {
    const product = getProducts().find((p) => p.id === id);
    if (!product) return;
    if (!confirm('למחוק את "' + product.name + '"?')) return;
    saveProducts(getProducts().filter((p) => p.id !== id));
  }

  function selectedIds() {
    return $$(".pick:checked").map((item) => item.value);
  }

  function applyBulkEdit() {
    const ids = selectedIds();
    if (!ids.length) {
      alert("בחר לפחות מוצר אחד.");
      return;
    }

    const status = $("#bulkStatus").value;
    const category = $("#bulkCategory").value;
    const price = $("#bulkPrice").value;
    const stock = $("#bulkStock").value;

    const next = getProducts().map((p) => {
      if (!ids.includes(p.id)) return p;
      return {
        ...p,
        ...(status ? {status} : {}),
        ...(category ? {category} : {}),
        ...(price !== "" ? {price: Number(price)} : {}),
        ...(stock !== "" ? {stock: Number(stock)} : {})
      };
    });

    saveProducts(next);
  }

  function csvCell(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    const columns = ["id","name","short","full","court","category","price","salePrice","cost","stock","lowStock","sku","barcode","height","teeth","fur","lining","box","embroidery","embroideryPrice","tags","status","seoTitle","seoDescription","slug"];
    const rows = getProducts();
    const csv = [
      columns.join(","),
      ...rows.map((p) => columns.map((key) => csvCell(Array.isArray(p[key]) ? p[key].join("|") : p[key])).join(","))
    ].join("\n");

    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "romtech-products.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line) {
    const out = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        out.push(value);
        value = "";
      } else {
        value += char;
      }
    }
    out.push(value);
    return out;
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((key, index) => row[key] = values[index] ?? "");

      ["price","salePrice","cost","stock","lowStock","height","teeth","embroideryPrice"].forEach((key) => {
        if (row[key] !== "") row[key] = Number(row[key]);
      });

      row.embroidery = String(row.embroidery).toLowerCase() === "true";
      row.tags = row.tags ? String(row.tags).split("|").filter(Boolean) : [];
      row.images = [];
      if (!row.id) row.id = "rt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      return row;
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        const max = 1000;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/webp", 0.78));
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };

      image.src = url;
    });
  }

  async function onImageFiles(files) {
    const remaining = Math.max(0, 10 - stagedImages.length);
    for (const file of Array.from(files).slice(0, remaining)) {
      try {
        stagedImages.push(await compressImage(file));
      } catch {
        alert("לא ניתן לקרוא אחת מהתמונות.");
      }
    }
    renderImagePreview();
  }

  function saveProductFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const product = Object.fromEntries(formData.entries());

    ["price","salePrice","cost","stock","lowStock","height","teeth","embroideryPrice"].forEach((key) => {
      product[key] = product[key] === "" ? null : Number(product[key]);
    });

    product.embroidery = Boolean(form.elements.namedItem("embroidery").checked);
    product.tags = String(product.tags || "").split(",").map((x) => x.trim()).filter(Boolean);
    product.images = [...stagedImages];
    product.id = $("#pid").value || "rt-" + Date.now();

    if (!product.slug) {
      product.slug = String(product.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const rows = getProducts();
    const index = rows.findIndex((p) => p.id === product.id);
    if (index >= 0) rows[index] = {...rows[index], ...product};
    else rows.push(product);

    try {
      saveProducts(rows);
      closeProductModal();
    } catch (error) {
      console.error(error);
      alert("לא ניתן לשמור. ייתכן שאחסון הדפדפן מלא בגלל תמונות גדולות.");
    }
  }

  function bindEvents() {
    $("#adminSubmit")?.addEventListener("click", enterAdmin);
    $("#adminCode")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        enterAdmin();
      }
    });
    $("#resetLocalPassword")?.addEventListener("click", resetPassword);
    $("#logoutBtn")?.addEventListener("click", logout);

    document.addEventListener("click", (event) => {
      const moduleButton = event.target.closest("[data-module]");
      if (moduleButton) {
        goToModule(moduleButton.dataset.module);
        return;
      }

      const goButton = event.target.closest("[data-go]");
      if (goButton) {
        goToModule(goButton.dataset.go);
        return;
      }

      const newProduct = event.target.closest('[data-action="new-product"]');
      if (newProduct) {
        goToModule("products");
        openProductModal();
        return;
      }

      const rowAction = event.target.closest("[data-row-action]");
      if (rowAction) {
        const id = rowAction.dataset.id;
        if (rowAction.dataset.rowAction === "edit") editProduct(id);
        if (rowAction.dataset.rowAction === "duplicate") duplicateProduct(id);
        if (rowAction.dataset.rowAction === "delete") deleteProduct(id);
        return;
      }

      const removeImage = event.target.closest("[data-remove-image]");
      if (removeImage) {
        stagedImages.splice(Number(removeImage.dataset.removeImage), 1);
        renderImagePreview();
      }
    });

    $("#newBtn")?.addEventListener("click", () => openProductModal());
    $("#closeModal")?.addEventListener("click", closeProductModal);
    $("#cancelModal")?.addEventListener("click", closeProductModal);
    $("#bulkApply")?.addEventListener("click", applyBulkEdit);
    $("#exportCsv")?.addEventListener("click", exportCsv);
    $("#inventoryRefresh")?.addEventListener("click", renderInventory);
    $("#productForm")?.addEventListener("submit", saveProductFromForm);

    $("#productImages")?.addEventListener("change", async (event) => {
      await onImageFiles(event.target.files || []);
      event.target.value = "";
    });

    $("#importCsv")?.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const rows = parseCsv(await file.text());
      event.target.value = "";
      if (!rows.length) {
        alert("לא נמצאו מוצרים בקובץ.");
        return;
      }
      if (confirm("לייבא " + rows.length + " מוצרים ולהחליף את הרשימה הנוכחית?")) {
        saveProducts(rows);
      }
    });

    $("#productModal")?.addEventListener("click", (event) => {
      if (event.target.id === "productModal") closeProductModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("#productModal")?.classList.contains("open")) {
        closeProductModal();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    refreshGate();

    if (sessionStorage.getItem(SESSION_KEY) === "1" && passwordState()) {
      showAdmin();
    } else {
      showGate();
    }
  });
})();