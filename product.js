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

function renderProduct(product){
 currentProduct=product;const root=$("#productView");if(!root)return;
 document.title=product.seoTitle||product.name;
 const s=RomTechData.loadSiteSettings(),wa=String(s.whatsapp||"").replace(/\D/g,"");
 root.innerHTML='<div class="product-layout">'+renderGallery(product)+'<div class="product-info"><div class="eyebrow">'+esc(product.court)+' · '+esc(product.category)+'</div><h1>'+esc(product.name)+'</h1><p class="lead">'+esc(product.full)+'</p><div class="price">'+money(product.salePrice||product.price)+(product.salePrice?'<span class="old">'+money(product.price)+'</span>':"")+'</div><p>מלאי זמין: '+Number(product.stock||0)+'</p><div class="actions product-buy-actions"><button class="btn buy-now-btn" id="buyNow" type="button">הזמן עכשיו</button><a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/'+wa+'?text='+encodeURIComponent("שלום, אשמח לקבל פרטים על "+product.name)+'">שאל ב-WhatsApp</a></div><div class="small order-note">הזמנה באתר שולחת בקשת הזמנה לרוםטק. נציג יחזור אליך לאישור פרטים ותשלום.</div></div></div><section class="section"><h2>מפרט טכני</h2><div class="specs"><div class="spec">גובה: '+product.height+' ס״מ</div><div class="spec">מספר שיניים: '+product.teeth+'</div><div class="spec">סוג פרווה: '+esc(product.fur)+'</div><div class="spec">צבע בטנה: '+esc(product.lining||"לפי בחירה")+'</div><div class="spec">קופסה: '+esc(product.box||"ללא")+'</div><div class="spec">רקמת שם: '+(product.embroidery?"אפשרית בתוספת "+money(product.embroideryPrice):"לא")+'</div></div></section><section class="section"><h2>משלוח והחזרות</h2><p>פרטי הביטול וההחזרה כפופים למדיניות האתר ולדין החל. <a href="returns.html">למדיניות המלאה</a></p></section>';
 bindSlider()
}
function openOrder(){if(!currentProduct)return;$("#orderProductId").value=currentProduct.id;$("#orderProductTitle").textContent="הזמנת "+currentProduct.name;$("#orderSummary").innerHTML='<strong>'+esc(currentProduct.name)+'</strong><span>'+money(currentProduct.salePrice||currentProduct.price)+'</span>';$("#orderMessage").hidden=true;$("#orderModal").classList.add("open");$("#orderModal").setAttribute("aria-hidden","false");setTimeout(()=>$("#orderName")?.focus(),0)}
function closeOrder(){$("#orderModal")?.classList.remove("open");$("#orderModal")?.setAttribute("aria-hidden","true")}
function submitOrder(e){e.preventDefault();if(!currentProduct)return;const order={id:"ord-"+Date.now(),productId:currentProduct.id,productName:currentProduct.name,price:Number(currentProduct.salePrice||currentProduct.price||0),customerName:$("#orderName").value.trim(),phone:$("#orderPhone").value.trim(),email:$("#orderEmail").value.trim(),city:$("#orderCity").value.trim(),address:$("#orderAddress").value.trim(),notes:$("#orderNotes").value.trim(),status:"new",createdAt:new Date().toISOString()};const orders=RomTechData.loadOrders();orders.unshift(order);RomTechData.saveOrders(orders);const m=$("#orderMessage");m.textContent="ההזמנה התקבלה! מספר הזמנה: "+order.id+". נציג יחזור אליך לאישור.";m.hidden=false;$("#orderForm").reset();$("#orderProductId").value=currentProduct.id}

document.addEventListener("DOMContentLoaded",()=>{
 const id=new URLSearchParams(location.search).get("id"),product=RomTechData.loadProducts().find(x=>x.id===id);
 if(!product){$("#productView").innerHTML="<h1>המוצר לא נמצא</h1>";return}
 renderProduct(product);
 document.addEventListener("click",e=>{const dot=e.target.closest("[data-gallery-index]");if(dot){setImage(Number(dot.dataset.galleryIndex));return}if(e.target.closest("#buyNow"))openOrder()});
 $("#closeOrderModal")?.addEventListener("click",closeOrder);$("#cancelOrder")?.addEventListener("click",closeOrder);$("#orderForm")?.addEventListener("submit",submitOrder);$("#orderModal")?.addEventListener("click",e=>{if(e.target.id==="orderModal")closeOrder()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeOrder()})
});
})();