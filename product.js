(() => {
  "use strict";

  const $ = (q) => document.querySelector(q);
  let currentProduct = null;
  let activeImage = 0;

  function imageList(product) {
    return Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  }

  function renderGallery(product) {
    const images = imageList(product);
    if (!images.length) {
      return '<div class="product-gallery"><div class="ph product-main-image" role="img" aria-label="' + esc(product.name) + '"></div></div>';
    }

    const thumbs = images.map((src, index) =>
      '<button class="product-thumb ' + (index === 0 ? 'active' : '') + '" type="button" data-gallery-index="' + index + '" aria-label="תמונה ' + (index + 1) + ' מתוך ' + images.length + '">' +
        '<img src="' + src + '" alt="">' +
      '</button>'
    ).join("");

    return '<div class="product-gallery">' +
      '<div class="product-main-wrap">' +
        '<button class="gallery-main-button" type="button" id="openLightbox" aria-label="הגדל תמונה">' +
          '<img class="product-main-image" id="productMainImage" src="' + images[0] + '" alt="' + esc(product.name) + '">' +
        '</button>' +
        (images.length > 1 ? '<button class="gallery-arrow prev" type="button" data-gallery-step="-1" aria-label="תמונה קודמת">‹</button><button class="gallery-arrow next" type="button" data-gallery-step="1" aria-label="תמונה הבאה">›</button>' : '') +
        '<div class="gallery-counter" id="galleryCounter">1 / ' + images.length + '</div>' +
      '</div>' +
      '<div class="product-thumbs">' + thumbs + '</div>' +
    '</div>';
  }

  function setImage(index) {
    const images = imageList(currentProduct);
    if (!images.length) return;
    activeImage = (index + images.length) % images.length;

    const main = $("#productMainImage");
    if (main) main.src = images[activeImage];

    document.querySelectorAll("[data-gallery-index]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.galleryIndex) === activeImage);
    });

    const counter = $("#galleryCounter");
    if (counter) counter.textContent = (activeImage + 1) + " / " + images.length;
  }

  function renderProduct(product) {
    currentProduct = product;
    const root = $("#productView");
    if (!root) return;

    document.title = product.seoTitle || product.name;

    root.innerHTML =
      '<div class="product-layout">' +
        renderGallery(product) +
        '<div class="product-info">' +
          '<div class="eyebrow">' + esc(product.court) + ' · ' + esc(product.category) + '</div>' +
          '<h1>' + esc(product.name) + '</h1>' +
          '<p class="lead">' + esc(product.full) + '</p>' +
          '<div class="price">' + money(product.salePrice || product.price) + (product.salePrice ? '<span class="old">' + money(product.price) + '</span>' : '') + '</div>' +
          '<p>מלאי זמין: ' + Number(product.stock || 0) + '</p>' +
          '<div class="actions product-buy-actions">' +
            '<button class="btn buy-now-btn" id="buyNow" type="button">הזמן עכשיו</button>' +
            '<a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/359879858846?text=' + encodeURIComponent("שלום, אשמח לקבל פרטים על " + product.name) + '">שאל ב-WhatsApp</a>' +
          '</div>' +
          '<div class="small order-note">הזמנה באתר שולחת בקשת הזמנה לרוםטק. נציג יחזור אליך לאישור פרטים ותשלום.</div>' +
        '</div>' +
      '</div>' +
      '<section class="section">' +
        '<h2>מפרט טכני</h2>' +
        '<div class="specs">' +
          '<div class="spec">גובה: ' + product.height + ' ס״מ</div>' +
          '<div class="spec">מספר שיניים: ' + product.teeth + '</div>' +
          '<div class="spec">סוג פרווה: ' + esc(product.fur) + '</div>' +
          '<div class="spec">צבע בטנה: ' + esc(product.lining || "לפי בחירה") + '</div>' +
          '<div class="spec">קופסה: ' + esc(product.box || "ללא") + '</div>' +
          '<div class="spec">רקמת שם: ' + (product.embroidery ? "אפשרית בתוספת " + money(product.embroideryPrice) : "לא") + '</div>' +
        '</div>' +
      '</section>' +
      '<section class="section">' +
        '<h2>משלוח והחזרות</h2>' +
        '<p>פרטי הביטול וההחזרה כפופים למדיניות האתר ולדין החל. <a href="returns.html">למדיניות המלאה</a></p>' +
      '</section>';
  }

  function openOrder() {
    if (!currentProduct) return;
    $("#orderProductId").value = currentProduct.id;
    $("#orderProductTitle").textContent = "הזמנת " + currentProduct.name;
    $("#orderSummary").innerHTML =
      '<strong>' + esc(currentProduct.name) + '</strong>' +
      '<span>' + money(currentProduct.salePrice || currentProduct.price) + '</span>';
    $("#orderMessage").hidden = true;
    $("#orderModal").classList.add("open");
    $("#orderModal").setAttribute("aria-hidden", "false");
    setTimeout(() => $("#orderName")?.focus(), 0);
  }

  function closeOrder() {
    $("#orderModal").classList.remove("open");
    $("#orderModal").setAttribute("aria-hidden", "true");
  }

  function submitOrder(event) {
    event.preventDefault();
    if (!currentProduct) return;

    const order = {
      id: "ord-" + Date.now(),
      productId: currentProduct.id,
      productName: currentProduct.name,
      price: Number(currentProduct.salePrice || currentProduct.price || 0),
      customerName: $("#orderName").value.trim(),
      phone: $("#orderPhone").value.trim(),
      email: $("#orderEmail").value.trim(),
      city: $("#orderCity").value.trim(),
      address: $("#orderAddress").value.trim(),
      notes: $("#orderNotes").value.trim(),
      status: "new",
      createdAt: new Date().toISOString()
    };

    const orders = RomTechData.loadOrders();
    orders.unshift(order);
    RomTechData.saveOrders(orders);

    const message = $("#orderMessage");
    message.textContent = "ההזמנה התקבלה! מספר הזמנה: " + order.id + ". נציג יחזור אליך לאישור.";
    message.hidden = false;

    $("#orderForm").reset();
    $("#orderProductId").value = currentProduct.id;
  }

  function openLightbox() {
    const images = imageList(currentProduct);
    if (!images.length) return;
    $("#lightboxImage").src = images[activeImage];
    $("#lightboxImage").alt = currentProduct.name;
    $("#productLightbox").hidden = false;
  }

  function closeLightbox() {
    $("#productLightbox").hidden = true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const product = RomTechData.loadProducts().find((item) => item.id === id);
    if (!product) {
      $("#productView").innerHTML = "<h1>המוצר לא נמצא</h1>";
      return;
    }

    renderProduct(product);

    document.addEventListener("click", (event) => {
      const thumb = event.target.closest("[data-gallery-index]");
      if (thumb) {
        setImage(Number(thumb.dataset.galleryIndex));
        return;
      }

      const step = event.target.closest("[data-gallery-step]");
      if (step) {
        setImage(activeImage + Number(step.dataset.galleryStep));
        return;
      }

      if (event.target.closest("#buyNow")) openOrder();
      if (event.target.closest("#openLightbox")) openLightbox();
    });

    $("#closeOrderModal")?.addEventListener("click", closeOrder);
    $("#cancelOrder")?.addEventListener("click", closeOrder);
    $("#orderForm")?.addEventListener("submit", submitOrder);
    $("#orderModal")?.addEventListener("click", (event) => {
      if (event.target.id === "orderModal") closeOrder();
    });

    $("#closeLightbox")?.addEventListener("click", closeLightbox);
    $("#productLightbox")?.addEventListener("click", (event) => {
      if (event.target.id === "productLightbox") closeLightbox();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeOrder();
        closeLightbox();
      }
      if (!$("#productLightbox").hidden || document.activeElement?.closest(".product-gallery")) {
        if (event.key === "ArrowLeft") setImage(activeImage + 1);
        if (event.key === "ArrowRight") setImage(activeImage - 1);
      }
    });
  });
})();