function el(q){return document.querySelector(q)}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function money(n){return new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:0}).format(Number(n||0))}
function siteSettings(){return window.RomTechData?.loadSiteSettings?.()||{phone:"+359 87 985 8846",whatsapp:"359879858846",email:"info@romtech.co.il",footerLabels:{}}}
function whatsappLink(message=""){
 const settings=siteSettings();
 if(window.RomTechData?.buildWhatsAppLink)return RomTechData.buildWhatsAppLink(settings.whatsapp,message);
 const digits=String(settings.whatsapp||"").replace(/\D/g,"");
 return digits?("https://wa.me/"+digits+(message?"?text="+encodeURIComponent(message):"")):""
}

function applySiteSettings(){
 const s=siteSettings();
 document.querySelectorAll("[data-site-phone]").forEach(n=>{n.textContent=s.phone||"";if(n.tagName==="A")n.href="tel:"+String(s.phone||"").replace(/\s/g,"")});
 document.querySelectorAll("[data-site-email]").forEach(n=>{n.textContent=s.email||"";if(n.tagName==="A")n.href="mailto:"+(s.email||"")});
 document.querySelectorAll("[data-site-whatsapp]").forEach(n=>{
  const href=whatsappLink(n.dataset.whatsappMessage||"");
  if(href)n.href=href;else n.removeAttribute("href")
 });
 document.querySelectorAll("[data-footer-key]").forEach(n=>{const k=n.dataset.footerKey;if(s.footerLabels?.[k])n.textContent=s.footerLabels[k]});
}

function injectGlobal(){
 const body=document.body;
 if(!document.querySelector('link[rel="icon"]')){
  const l=document.createElement("link");l.rel="icon";l.type="image/svg+xml";l.href=(location.pathname.includes("/admin/")?"../":"")+"assets/favicon.svg";document.head.appendChild(l)
 }
 if(!el(".wa")&&!body.classList.contains("admin-page")){
  const wa=whatsappLink();
  body.insertAdjacentHTML("beforeend",'<a class="wa" aria-label="פתיחת WhatsApp" href="'+esc(wa)+'" target="_blank" rel="noopener">WhatsApp</a><div class="access"><button class="btn" id="accBtn" aria-expanded="false">נגישות</button><div class="access-panel" id="accPanel" role="dialog" aria-label="אפשרויות נגישות"><button data-a="font">הגדלת טקסט</button><button data-a="contrast">ניגודיות גבוהה</button><button data-a="readable">גופן קריא</button><button data-a="motion">עצירת אנימציות</button><button data-a="links">הדגשת קישורים</button><button data-a="reset">איפוס</button></div></div>')
 }
 const btn=el("#accBtn"),panel=el("#accPanel");
 btn?.addEventListener("click",()=>{panel.classList.toggle("open");btn.setAttribute("aria-expanded",panel.classList.contains("open"))});
 let fs=Number(localStorage.rt_font||100);document.documentElement.style.fontSize=fs+"%";
 ["contrast","readable","motion","links"].forEach(k=>{if(localStorage["rt_"+k]==="1")body.classList.add(k==="contrast"?"high-contrast":k==="motion"?"no-motion":k==="links"?"links-highlight":"readable")});
 panel?.addEventListener("click",e=>{const k=e.target.dataset.a;if(!k)return;if(k==="font"){fs=fs>=125?100:fs+10;localStorage.rt_font=fs;document.documentElement.style.fontSize=fs+"%";return}if(k==="reset"){["rt_contrast","rt_readable","rt_motion","rt_links","rt_font"].forEach(x=>localStorage.removeItem(x));location.reload();return}const cls=k==="contrast"?"high-contrast":k==="motion"?"no-motion":k==="links"?"links-highlight":"readable";body.classList.toggle(cls);localStorage["rt_"+k]=body.classList.contains(cls)?"1":"0"});
 if(!localStorage.rt_cookie&&!body.classList.contains("admin-page")&&!body.classList.contains("cookie-page")){
  body.insertAdjacentHTML("beforeend",'<div class="cookie" id="cookie"><strong>העדפות עוגיות</strong><div>אנחנו משתמשים בעוגיות כדי לשפר את חוויית הגלישה שלך.</div><div class="actions"><button class="btn" data-c="all">אשר הכל</button><button class="btn secondary" data-c="essential">דחה לא הכרחיות</button><a class="btn secondary" href="cookies.html">הגדרות</a></div></div>')
 }
 el("#cookie")?.addEventListener("click",e=>{const v=e.target.dataset.c;if(!v)return;localStorage.rt_cookie=JSON.stringify({essential:true,analytics:v==="all",marketing:v==="all",functional:v==="all",at:new Date().toISOString()});el("#cookie").remove()})
}

function reviewStars(value){return "★".repeat(Number(value||0))+"☆".repeat(Math.max(0,5-Number(value||0)))}
function setupHomeReviewForm(){
 const productSelect=el("#homeReviewProduct");
 if(!productSelect)return;
 const products=RomTechData.loadProducts().filter(p=>p.status==="published");
 productSelect.innerHTML=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("")
}
function openHomeReviewModal(){
 setupHomeReviewForm();
 const modal=el("#homeReviewModal"),msg=el("#homeReviewMessage");
 if(msg)msg.hidden=true;
 modal?.classList.add("open");
 modal?.setAttribute("aria-hidden","false");
 setTimeout(()=>el("#homeReviewName")?.focus(),0)
}
function closeHomeReviewModal(){
 const modal=el("#homeReviewModal");
 modal?.classList.remove("open");
 modal?.setAttribute("aria-hidden","true")
}
function submitHomeReview(event){
 event.preventDefault();
 const productId=el("#homeReviewProduct").value,product=RomTechData.loadProducts().find(p=>p.id===productId);
 if(!product)return;
 const review={id:"rev-"+Date.now(),productId,productName:product.name,name:el("#homeReviewName").value.trim(),rating:Number(el("#homeReviewRating").value||5),text:el("#homeReviewText").value.trim(),status:"pending",createdAt:new Date().toISOString()};
 if(!review.name||!review.text)return;
 const rows=RomTechData.loadReviews?.()||[];
 rows.unshift(review);
 RomTechData.saveReviews(rows);
 event.currentTarget.reset();
 const m=el("#homeReviewMessage");if(m){m.textContent="תודה! הביקורת נשלחה לאישור.";m.hidden=false}setTimeout(closeHomeReviewModal,1200)
}
function renderCatalog(){
 const root=el("#catalog");if(!root)return;
 const all=RomTechData.loadProducts().filter(x=>x.status==="published"),q=(el("#search")?.value||"").trim(),cat=el("#category")?.value||"",court=el("#court")?.value||"";
 const rows=all.filter(p=>(!q||[p.name,p.short,p.court,p.category,p.fur].join(" ").includes(q))&&(!cat||p.category===cat)&&(!court||p.court===court));
 root.innerHTML=rows.map(p=>{
  const url="product.html?id="+encodeURIComponent(p.id);
  const media=p.images?.[0]
    ? '<a class="product-card-image" href="'+url+'"><img src="'+p.images[0]+'" alt="'+esc(p.name)+'"></a>'
    : '';
  const labels=(p.tags||[]).length?'<div class="product-labels">'+(p.tags||[]).map(esc).join(" · ")+'</div>':"";
  return '<article class="product-card '+(media?"has-image":"no-image")+'">'+media+
    '<div class="card-body">'+labels+
      '<div class="product-card-context">'+esc(p.court)+' · '+esc(p.category)+'</div>'+
      '<h3><a href="'+url+'">'+esc(p.name)+'</a></h3>'+
      '<div class="price">'+money(p.salePrice||p.price)+(p.salePrice?'<span class="old">'+money(p.price)+'</span>':"")+'</div>'+
      '<div class="product-card-specs"><span>פרווה: '+esc(p.fur)+'</span><span>גובה: '+p.height+' ס״מ</span></div>'+
      '<p>'+esc(p.short)+'</p>'+
      '<div class="product-card-links"><a class="product-primary-link" href="'+url+'">לפרטים ולהזמנה</a><a target="_blank" rel="noopener" href="'+esc(whatsappLink("שלום, אשמח לפרטים על "+p.name))+'">שאלה ב-WhatsApp</a></div>'+
    '</div></article>'
 }).join("")||'<p class="catalog-empty">לא נמצאו דגמים.</p>'
}
document.addEventListener("DOMContentLoaded",()=>{applySiteSettings();injectGlobal();["search","category","court"].forEach(id=>el("#"+id)?.addEventListener("input",renderCatalog));renderCatalog();setupHomeReviewForm();el("#homeReviewSubmit")?.addEventListener("submit",submitHomeReview);el("#openReviewModal")?.addEventListener("click",openHomeReviewModal);el("#closeHomeReviewModal")?.addEventListener("click",closeHomeReviewModal);el("#cancelHomeReviewModal")?.addEventListener("click",closeHomeReviewModal);el("#homeReviewModal")?.addEventListener("click",e=>{if(e.target.id==="homeReviewModal")closeHomeReviewModal()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHomeReviewModal()})});