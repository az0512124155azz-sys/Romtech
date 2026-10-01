(() => {
"use strict";
const $=q=>document.querySelector(q);
let currentProduct=null,activeImage=0;
const imagesOf=p=>Array.isArray(p.images)?p.images.filter(Boolean):[];

function renderGallery(product){
 const images=imagesOf(product);
 if(!images.length)return '<div class="product-gallery"><div class="ph product-main-image" role="img" aria-label="'+esc(product.name)+'"></div></div>';
 const slides=images.map((src,i)=>'<div class="product-slide" data-slide-index="'+i+'"><img src="'+src+'" draggable="false" alt="'+esc(product.name)+' — תמונה '+(i+1)+'"></div>').join("");
 const dots=images.length>1?'<div class="product-dots" dir="rtl" aria-label="בחירת תמונה">'+images.map((_,i)=>'<button class="product-dot '+(i===0?"active":"")+'" type="button" data-gallery-index="'+i+'" aria-label="תמונה '+(i+1)+'" aria-current="'+(i===0?"true":"false")+'"></button>').join("")+'</div>':"";
 return '<div class="product-gallery"><div class="product-slider" id="productSlider" tabindex="0" aria-label="גלריית תמונות מוצר"><div class="product-slider-track" id="productSliderTrack">'+slides+'</div></div>'+dots+'</div>'
}
function updateDots(){
 document.querySelectorAll("[data-gallery-index]").forEach(dot=>{
  const active=Number(dot.dataset.galleryIndex)===activeImage;
  dot.classList.toggle("active",active);
  dot.setAttribute("aria-current",active?"true":"false")
 })
}
function positionTrack(dragPx=0,animate=true){
 const track=$("#productSliderTrack");if(!track)return;
 track.style.transition=animate?"transform .24s ease":"none";
 track.style.transform='translate3d(calc('+(-activeImage*100)+'% + '+dragPx+'px),0,0)';
 updateDots()
}
function setImage(index,animate=true){
 const images=imagesOf(currentProduct);if(!images.length)return;
 activeImage=Math.max(0,Math.min(Number(index)||0,images.length-1));
 positionTrack(0,animate)
}
function bindSlider(){
 const slider=$("#productSlider"),track=$("#productSliderTrack");if(!slider||!track)return;
 activeImage=0;positionTrack(0,false);
 let tracking=false,startX=0,startY=0,lastX=0,pointerId=null,moved=false;
 slider.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  tracking=true;moved=false;pointerId=e.pointerId;startX=lastX=e.clientX;startY=e.clientY;
  slider.classList.add("dragging");
  slider.setPointerCapture?.(e.pointerId)
 });
 slider.addEventListener("pointermove",e=>{
  if(!tracking||e.pointerId!==pointerId)return;
  const dx=e.clientX-startX,dy=e.clientY-startY;
  lastX=e.clientX;
  if(Math.abs(dx)>4)moved=true;
  if(Math.abs(dx)>Math.abs(dy)){
   e.preventDefault();
   let visualDx=dx;
   if((activeImage===0&&dx>0)||(activeImage===imagesOf(currentProduct).length-1&&dx<0))visualDx*=.28;
   positionTrack(visualDx,false)
  }
 });
 const finish=e=>{
  if(!tracking||e.pointerId!==pointerId)return;
  tracking=false;slider.classList.remove("dragging");
  const dx=(e.clientX??lastX)-startX,dy=(e.clientY??startY)-startY;
  if(Math.abs(dx)>=42&&Math.abs(dx)>Math.abs(dy)*1.1){
   // Natural swipe: left = next image, right = previous image. Exactly one image per gesture.
   setImage(activeImage+(dx<0?1:-1),true)
  }else{
   positionTrack(0,true)
  }
  try{slider.releasePointerCapture?.(e.pointerId)}catch{}
 };
 slider.addEventListener("pointerup",finish);
 slider.addEventListener("pointercancel",e=>{if(!tracking)return;tracking=false;slider.classList.remove("dragging");positionTrack(0,true);try{slider.releasePointerCapture?.(e.pointerId)}catch{}});
 slider.addEventListener("dragstart",e=>e.preventDefault());
 slider.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"){e.preventDefault();setImage(activeImage+1,true)}
  if(e.key==="ArrowRight"){e.preventDefault();setImage(activeImage-1,true)}
  if(e.key==="Home"){e.preventDefault();setImage(0,true)}
  if(e.key==="End"){e.preventDefault();setImage(imagesOf(currentProduct).length-1,true)}
 })
}
function stars(value){return "★".repeat(Number(value||0))+"☆".repeat(Math.max(0,5-Number(value||0)))}
function productReviews(productId){return (RomTechData.loadReviews?.()||[]).filter(r=>r.productId===productId)}
function reviewsHtml(product){
 const rows=productReviews(product.id);
 return '<section class="section reviews-section"><div class="reviews-head"><div><h2>ביקורות לקוחות</h2><p class="small">'+(rows.length?rows.length+" ביקורות":"עדיין אין ביקורות למוצר הזה")+'</p></div></div>'+
 '<div class="reviews-list">'+(rows.length?rows.map(r=>'<article class="review-card"><div class="review-card-head"><strong>'+esc(r.name||"לקוח")+'</strong><span class="review-stars" aria-label="'+Number(r.rating||0)+' מתוך 5">'+stars(r.rating)+'</span></div><p>'+esc(r.text||"")+'</p><div class="small">'+esc(r.createdAt?new Date(r.createdAt).toLocaleDateString("he-IL"):"")+'</div></article>').join(""):'')+'</div>'+
 '<div class="review-form-card review-page-link-card"><h3>רוצה לשתף את החוויה?</h3><p>כל הביקורות מרוכזות בעמוד אחד, ושם אפשר גם לכתוב ביקורת חדשה.</p><a class="btn" href="reviews.html?product='+encodeURIComponent(product.id)+'#write-review">לכל הביקורות ולכתיבת ביקורת</a></div></section>'
}
function renderProduct(product){
 currentProduct=product;const root=$("#productView");if(!root)return;
 document.title=product.seoTitle||product.name;
 const s=RomTechData.loadSiteSettings();
 root.innerHTML='<div class="product-layout">'+renderGallery(product)+'<div class="product-info"><div class="eyebrow">'+esc(product.court)+' · '+esc(product.category)+'</div><h1>'+esc(product.name)+'</h1><p class="lead">'+esc(product.full)+'</p><div class="price">'+money(product.salePrice||product.price)+(product.salePrice?'<span class="old">'+money(product.price)+'</span>':"")+'</div><p>מלאי זמין: '+Number(product.stock||0)+'</p><div class="actions product-buy-actions"><button class="btn buy-now-btn" id="buyNow" type="button">הזמן עכשיו</button><a class="btn secondary" target="_blank" rel="noopener" href="'+esc(RomTechData.buildWhatsAppLink(s.whatsapp,"שלום, אשמח לקבל פרטים על "+product.name))+'">שאל ב-WhatsApp</a></div><div class="small order-note">הזמנה באתר שולחת בקשת הזמנה לרוםטק. נציג יחזור אליך לאישור פרטים ותשלום.</div></div></div><section class="section"><h2>מפרט טכני</h2><div class="specs"><div class="spec">גובה: '+product.height+' ס״מ</div><div class="spec">מספר שיניים: '+product.teeth+'</div><div class="spec">סוג פרווה: '+esc(product.fur)+'</div><div class="spec">צבע בטנה: '+esc(product.lining||"לפי בחירה")+'</div><div class="spec">קופסה: '+esc(product.box||"ללא")+'</div><div class="spec">רקמת שם: '+(product.embroidery?"אפשרית בתוספת "+money(product.embroideryPrice):"לא")+'</div></div></section><section class="section"><h2>משלוח והחזרות</h2><p>פרטי הביטול וההחזרה כפופים למדיניות האתר ולדין החל. <a href="returns.html">למדיניות המלאה</a></p></section>'+reviewsHtml(product);
 bindSlider()
}
function openOrder(){if(!currentProduct)return;$("#orderProductId").value=currentProduct.id;$("#orderProductTitle").textContent="הזמנת "+currentProduct.name;$("#orderSummary").innerHTML='<strong>'+esc(currentProduct.name)+'</strong><span>'+money(currentProduct.salePrice||currentProduct.price)+'</span>';$("#orderMessage").hidden=true;$("#orderModal").classList.add("open");$("#orderModal").setAttribute("aria-hidden","false");setTimeout(()=>$("#orderName")?.focus(),0)}
function closeOrder(){$("#orderModal")?.classList.remove("open");$("#orderModal")?.setAttribute("aria-hidden","true")}
function submitReview(e){
 e.preventDefault();if(!currentProduct)return;
 const name=$("#reviewName").value.trim(),text=$("#reviewText").value.trim(),rating=Number($("#reviewRating").value||5);
 if(!name||!text)return;
 const reviews=RomTechData.loadReviews();
 reviews.unshift({id:"rev-"+Date.now(),productId:currentProduct.id,productName:currentProduct.name,name,rating,text,status:"approved",createdAt:new Date().toISOString()});
 RomTechData.saveReviews(reviews);
 e.currentTarget.reset();
 const m=$("#reviewMessage");m.textContent="תודה! הביקורת פורסמה באתר.";m.hidden=false
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