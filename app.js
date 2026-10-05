function el(q){return document.querySelector(q)}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function money(n){return new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:0}).format(Number(n||0))}
function ensureRuntimeFavicon(){
 let link=document.querySelector('link[rel~="icon"]');
 if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link)}
 link.type="image/svg+xml";link.removeAttribute("sizes");link.href="assets/favicon.svg?v=20261002-56";
}
function siteSettings(){return window.RomTechData?.loadSiteSettings?.()||{phone:"+359 87 985 8846",whatsapp:"359879858846",email:"info@romtech.co.il",footerLabels:{}}}
function whatsappLink(message=""){
 const settings=siteSettings();
 if(window.RomTechData?.buildWhatsAppLink)return RomTechData.buildWhatsAppLink(settings.whatsapp,message,settings.phone);
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
  body.insertAdjacentHTML("beforeend",'<a class="wa" aria-label="פתיחת WhatsApp" href="'+esc(wa)+'" target="_blank" rel="noopener">WhatsApp</a><div class="access"><button class="btn" id="accBtn" type="button" aria-expanded="false" aria-controls="accPanel">נגישות</button><div class="access-panel" id="accPanel" role="dialog" aria-label="אפשרויות נגישות"><button type="button" data-a="font">גודל טקסט: 100%</button><button type="button" data-a="contrast">ניגודיות גבוהה</button><button type="button" data-a="readable">גופן קריא</button><button type="button" data-a="motion">עצירת אנימציות</button><button type="button" data-a="links">הדגשת קישורים</button><button type="button" data-a="reset">איפוס הגדרות</button></div></div>')
 }
 const btn=el("#accBtn"),panel=el("#accPanel");
 const map={contrast:"high-contrast",readable:"readable",motion:"no-motion",links:"links-highlight"};
 let fs=Math.max(100,Math.min(130,Number(localStorage.rt_font||100)||100));
 const textSelector="h1,h2,h3,h4,h5,h6,p,a,button,label,input,select,textarea,li,td,th,small,strong,.small,.lead,.price,.eyebrow,.tag,.review-stars,.footer-tagline";
 function setFontScale(){
  document.querySelectorAll(textSelector).forEach(n=>{
   if(!n.hasAttribute("data-a11y-original-font"))n.setAttribute("data-a11y-original-font",n.style.fontSize||"");
   const original=n.getAttribute("data-a11y-original-font");
   if(original)n.style.fontSize=original;else n.style.removeProperty("font-size");
   if(fs>100){
    const base=parseFloat(getComputedStyle(n).fontSize);
    if(Number.isFinite(base)&&base>0)n.style.fontSize=(base*fs/100).toFixed(2)+"px"
   }
  });
  const b=panel?.querySelector('[data-a="font"]');
  if(b){b.textContent="גודל טקסט: "+fs+"%";b.classList.toggle("active",fs>100);b.setAttribute("aria-pressed",fs>100?"true":"false")}
 }
 function syncButtons(){
  Object.entries(map).forEach(([k,cls])=>{
   const b=panel?.querySelector('[data-a="'+k+'"]'),on=body.classList.contains(cls);
   if(b){b.classList.toggle("active",on);b.setAttribute("aria-pressed",on?"true":"false")}
  })
 }
 btn?.addEventListener("click",()=>{
  const open=!panel.classList.contains("open");
  panel.classList.toggle("open",open);btn.setAttribute("aria-expanded",open?"true":"false");
  if(open)panel.querySelector("button")?.focus()
 });
 Object.entries(map).forEach(([k,cls])=>{if(localStorage["rt_"+k]==="1")body.classList.add(cls)});
 setFontScale();syncButtons();
 panel?.addEventListener("click",e=>{
  const control=e.target.closest("button[data-a]");if(!control)return;
  const k=control.dataset.a;
  if(k==="font"){fs=fs>=130?100:fs+10;localStorage.rt_font=String(fs);setFontScale();return}
  if(k==="reset"){
   ["rt_contrast","rt_readable","rt_motion","rt_links","rt_font"].forEach(x=>localStorage.removeItem(x));
   Object.values(map).forEach(cls=>body.classList.remove(cls));fs=100;setFontScale();syncButtons();return
  }
  const cls=map[k];if(!cls)return;
  body.classList.toggle(cls);localStorage["rt_"+k]=body.classList.contains(cls)?"1":"0";syncButtons()
 });
 document.addEventListener("click",e=>{if(panel?.classList.contains("open")&&!e.target.closest(".access")){panel.classList.remove("open");btn?.setAttribute("aria-expanded","false")}});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&panel?.classList.contains("open")){panel.classList.remove("open");btn?.setAttribute("aria-expanded","false");btn?.focus()}});
 window.addEventListener("resize",()=>{if(fs>100)setFontScale()});
 const observer=new MutationObserver(ms=>{if(fs===100)return;ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;if(n.matches?.(textSelector)){const original=n.style.fontSize||"";n.setAttribute("data-a11y-original-font",original);const base=parseFloat(getComputedStyle(n).fontSize);if(Number.isFinite(base))n.style.fontSize=(base*fs/100).toFixed(2)+"px"}n.querySelectorAll?.(textSelector).forEach(x=>{if(!x.hasAttribute("data-a11y-original-font"))x.setAttribute("data-a11y-original-font",x.style.fontSize||"");const original=x.getAttribute("data-a11y-original-font");if(original)x.style.fontSize=original;else x.style.removeProperty("font-size");const base=parseFloat(getComputedStyle(x).fontSize);if(Number.isFinite(base))x.style.fontSize=(base*fs/100).toFixed(2)+"px"})}))});
 observer.observe(body,{childList:true,subtree:true});
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
async function submitHomeReview(event){
 const form=event.currentTarget;
 event.preventDefault();
 const productId=el("#homeReviewProduct").value,product=RomTechData.loadProducts().find(p=>p.id===productId);
 if(!product)return;
 const review={id:form.dataset.requestId||(form.dataset.requestId=RomTechData.newId('rev')),productId,productName:product.name,name:el("#homeReviewName").value.trim(),rating:Number(el("#homeReviewRating").value||5),text:el("#homeReviewText").value.trim(),status:"pending",createdAt:new Date().toISOString()};
 if(!review.name||!review.text)return;
 await RomTechData.submitReview({...review,status:"approved"});
 form.reset();delete form.dataset.requestId;
 const m=el("#homeReviewMessage");if(m){m.textContent="תודה! הביקורת פורסמה באתר.";m.hidden=false}setTimeout(closeHomeReviewModal,1200)
}
function renderCatalog(){
 const root=el("#catalog");if(!root)return;
 const all=RomTechData.loadProducts().filter(x=>x.status==="published"),q=(el("#search")?.value||"").trim(),cat=el("#category")?.value||"",court=el("#court")?.value||"";
 const rows=all.filter(p=>(!q||[p.name,p.short,p.court,p.category,p.fur].join(" ").includes(q))&&(!cat||p.category===cat)&&(!court||p.court===court));
 root.innerHTML=rows.map(p=>'<article class="card">'+(p.images?.[0]?'<img src="'+esc(p.images[0])+'" alt="'+esc(p.name)+'">':'<div class="ph" role="img" aria-label="'+esc(p.name)+'"></div>')+'<div class="card-body"><div>'+((p.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join(""))+'</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.short)+'</p><div class="price">'+money(p.salePrice||p.price)+(p.salePrice?'<span class="old">'+money(p.price)+'</span>':"")+'</div><div class="small">מלאי: '+p.stock+' · '+esc(p.fur)+' · '+p.height+' ס״מ</div><div class="actions"><a class="btn" href="product.html?id='+encodeURIComponent(p.id)+'">לצפייה והזמנה</a><a class="btn secondary" target="_blank" rel="noopener" href="'+esc(whatsappLink("שלום, אשמח לפרטים על "+p.name))+'">שאל ב-WhatsApp</a></div></div></article>').join("")||'<p>לא נמצאו מוצרים.</p>'
}
document.addEventListener("DOMContentLoaded",async ()=>{await RomTechData.ready;ensureRuntimeFavicon();applySiteSettings();injectGlobal();["search","category","court"].forEach(id=>el("#"+id)?.addEventListener("input",renderCatalog));renderCatalog();setupHomeReviewForm();el("#homeReviewSubmit")?.addEventListener("submit",submitHomeReview);el("#openReviewModal")?.addEventListener("click",openHomeReviewModal);el("#closeHomeReviewModal")?.addEventListener("click",closeHomeReviewModal);el("#cancelHomeReviewModal")?.addEventListener("click",closeHomeReviewModal);el("#homeReviewModal")?.addEventListener("click",e=>{if(e.target.id==="homeReviewModal")closeHomeReviewModal()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHomeReviewModal()})});
window.addEventListener("romtech-data-changed",()=>{applySiteSettings();renderCatalog()});
