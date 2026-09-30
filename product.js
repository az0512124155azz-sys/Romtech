(() => {
"use strict";
const $=q=>document.querySelector(q);
let currentProduct=null,activeImage=0;
const imagesOf=p=>Array.isArray(p.images)?p.images.filter(Boolean):[];

function renderGallery(product){
 const images=imagesOf(product);
 if(!images.length)return '<div class="product-gallery"><div class="ph product-main-image" role="img" aria-label="'+esc(product.name)+'"></div></div>';
 const slides=images.map((src,i)=>'<div class="product-slide" data-slide-index="'+i+'"><img src="'+src+'" alt="'+esc(product.name)+' — תמונה '+(i+1)+'"></div>').join("");
 const dots=images.length>1?'<div class="product-dots">'+images.map((_,i)=>'<button class="product-dot '+(i===0?"active":"")+'" type="button" data-gallery-index="'+i+'" aria-label="תמונה '+(i+1)+'"></button>').join("")+'</div>':"";
 return '<div class="product-gallery"><div class="product-slider" id="productSlider">'+slides+'</div>'+dots+'</div>'
}
function updateDots(){document.querySelectorAll("[data-gallery-index]").forEach(b=>b.classList.toggle("active",Number(b.dataset.galleryIndex)===activeImage))}
function setImage(index,behavior="smooth"){
 const slider=$("#productSlider"),images=imagesOf(currentProduct);if(!slider||!images.length)return;
 activeImage=Math.max(0,Math.min(index,images.length-1));
 slider.scrollTo({left:slider.clientWidth*activeImage,behavior});updateDots()
}
function bindSlider(){
 const slider=$("#productSlider");if(!slider)return;
 let dragging=false,startX=0,startScroll=0,timer;
 slider.addEventListener("pointerdown",e=>{dragging=true;startX=e.clientX;startScroll=slider.scrollLeft;slider.setPointerCapture?.(e.pointerId)});
 slider.addEventListener("pointermove",e=>{if(dragging)slider.scrollLeft=startScroll-(e.clientX-startX)});
 const finish=()=>{if(!dragging)return;dragging=false;setImage(Math.round(slider.scrollLeft/Math.max(1,slider.clientWidth)))};
 slider.addEventListener("pointerup",finish);slider.addEventListener("pointercancel",finish);
 slider.addEventListener("scroll",()=>{clearTimeout(timer);timer=setTimeout(()=>{activeImage=Math.max(0,Math.min(Math.round(slider.scrollLeft/Math.max(1,slider.clientWidth)),imagesOf(currentProduct).length-1));updateDots()},70)})
}

function stars(value){return "★".repeat(Number(value||0))+"☆".repeat(Math.max(0,5-Number(value||0)))}
function approvedReviews(productId){return (RomTechData.loadReviews?.()||[]).filter(r=>r.productId===productId&&r.status==="approved")}
function reviewsHtml(product){
 const rows=approvedReviews(product.id);
 return '<section class="section reviews-section"><div class="reviews-head"><div><h2>ביקורות לקוחות</h2><p class="small">'+(rows.length?rows.length+" ביקורות מאושרות":"עדיין אין ביקורות מאושרות למוצר הזה")+'</p></div></div>'+
 '<div class="reviews-list">'+(rows.length?rows.map(r=>'<article class="review-card"><div class="review-card-head"><strong>'+esc(r.name||"לקוח")+'</strong><span class="review-stars" aria-label="'+Number(r.rating||0)+' מתוך 5">'+stars(r.rating)+'</span></div><p>'+esc(r.text||"")+'</p><div class="small">'+esc(r.createdAt?new Date(r.createdAt).toLocaleDateString("he-IL"):"")+'</div></article>').join(""):'')+'</div>'+
 '<div class="review-form-card"><h3>כתוב ביקורת</h3><form id="reviewForm"><div class="form-grid"><label>שם<input id="reviewName" required maxlength="60"></label><label>דירוג<select id="reviewRating" required><option value="5">5 — מצוין</option><option value="4">4 — טוב מאוד</option><option value="3">3 — טוב</option><option value="2">2 — בינוני</option><option value="1">1 — לא טוב</option></select></label><label class="full">הביקורת שלך<textarea id="reviewText" required rows="5" maxlength="1200" placeholder="ספר לנו על החוויה שלך"></textarea></label></div><button class="btn" type="submit">שלח ביקורת</button><div id="reviewMessage" class="notice success" hidden></div></form></div></section>'
}
function renderProduct(product){
 currentProduct=product;const root=$("#productView");if(!root)return;
 document.title=product.seoTitle||product.name;
 const s=RomTechData.loadSiteSettings(),wa=String(s.whatsapp||"").replace(/\D/g,"");
 root.innerHTML='<div class="product-layout">'+renderGallery(product)+'<div class="product-info"><div class="eyebrow">'+esc(product.court)+' · '+esc(product.category)+'</div><h1>'+esc(product.name)+'</h1><p class="lead">'+esc(product.full)+'</p><div class="price">'+money(product.salePrice||product.price)+(product.salePrice?'<span class="old">'+money(product.price)+'</span>':"")+'</div><p>מלאי זמין: '+Number(product.stock||0)+'</p><div class="actions product-buy-actions"><button class="btn buy-now-btn" id="buyNow" type="button">הזמן עכשיו</button><a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/'+wa+'?text='+encodeURIComponent("שלום, אשמח לקבל פרטים על "+product.name)+'">שאל ב-WhatsApp</a></div><div class="small order-note">הזמנה באתר שולחת בקשת הזמנה לרוםטק. נציג יחזור אליך לאישור פרטים ותשלום.</div></div></div><section class="section"><h2>מפרט טכני</h2><div class="specs"><div class="spec">גובה: '+product.height+' ס״מ</div><div class="spec">מספר שיניים: '+product.teeth+'</div><div class="spec">סוג פרווה: '+esc(product.fur)+'</div><div class="spec">צבע בטנה: '+esc(product.lining||"לפי בחירה")+'</div><div class="spec">קופסה: '+esc(product.box||"ללא")+'</div><div class="spec">רקמת שם: '+(product.embroidery?"אפשרית בתוספת "+money(product.embroideryPrice):"לא")+'</div></div></section><section class="section"><h2>משלוח והחזרות</h2><p>פרטי הביטול וההחזרה כפופים למדיניות האתר ולדין החל. <a href="returns.html">למדיניות המלאה</a></p></section>'+reviewsHtml(product);
 bindSlider()
}
function openOrder(){if(!currentProduct)return;$("#orderProductId").value=currentProduct.id;$("#orderProductTitle").textContent="הזמנת "+currentProduct.name;$("#orderSummary").innerHTML='<strong>'+esc(currentProduct.name)+'</strong><span>'+money(currentProduct.salePrice||currentProduct.price)+'</span>';$("#orderMessage").hidden=true;$("#orderModal").classList.add("open");$("#orderModal").setAttribute("aria-hidden","false");setTimeout(()=>$("#orderName")?.focus(),0)}
function closeOrder(){$("#orderModal")?.classList.remove("open");$("#orderModal")?.setAttribute("aria-hidden","true")}
function submitReview(e){
 e.preventDefault();if(!currentProduct)return;
 const name=$("#reviewName").value.trim(),text=$("#reviewText").value.trim(),rating=Number($("#reviewRating").value||5);
 if(!name||!text)return;
 const reviews=RomTechData.loadReviews();
 reviews.unshift({id:"rev-"+Date.now(),productId:currentProduct.id,productName:currentProduct.name,name,rating,text,status:"pending",createdAt:new Date().toISOString()});
 RomTechData.saveReviews(reviews);
 e.currentTarget.reset();
 const m=$("#reviewMessage");m.textContent="תודה! הביקורת נשלחה ותופיע באתר לאחר אישור.";m.hidden=false
}
function submitOrder(e){e.preventDefault();if(!currentProduct)return;const order={id:"ord-"+Date.now(),productId:currentProduct.id,productName:currentProduct.name,price:Number(currentProduct.salePrice||currentProduct.price||0),customerName:$("#orderName").value.trim(),phone:$("#orderPhone").value.trim(),email:$("#orderEmail").value.trim(),city:$("#orderCity").value.trim(),address:$("#orderAddress").value.trim(),notes:$("#orderNotes").value.trim(),status:"new",createdAt:new Date().toISOString()};const orders=RomTechData.loadOrders();orders.unshift(order);RomTechData.saveOrders(orders);const m=$("#orderMessage");m.textContent="ההזמנה התקבלה! מספר הזמנה: "+order.id+". נציג יחזור אליך לאישור.";m.hidden=false;$("#orderForm").reset();$("#orderProductId").value=currentProduct.id}

document.addEventListener("DOMContentLoaded",()=>{
 const id=new URLSearchParams(location.search).get("id"),product=RomTechData.loadProducts().find(x=>x.id===id);
 if(!product){$("#productView").innerHTML="<h1>המוצר לא נמצא</h1>";return}
 renderProduct(product);
 document.addEventListener("click",e=>{const dot=e.target.closest("[data-gallery-index]");if(dot){setImage(Number(dot.dataset.galleryIndex));return}if(e.target.closest("#buyNow"))openOrder()});
 $("#reviewForm")?.addEventListener("submit",submitReview);$("#closeOrderModal")?.addEventListener("click",closeOrder);$("#cancelOrder")?.addEventListener("click",closeOrder);$("#orderForm")?.addEventListener("submit",submitOrder);$("#orderModal")?.addEventListener("click",e=>{if(e.target.id==="orderModal")closeOrder()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeOrder()})
});
})();