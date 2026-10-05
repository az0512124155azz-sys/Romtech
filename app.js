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
  body.insertAdjacentHTML("beforeend",
   '<a class="wa" aria-label="פתיחת WhatsApp" href="'+esc(wa)+'" target="_blank" rel="noopener">WhatsApp</a>'+
   '<div class="access">'+
    '<button class="btn" id="accBtn" type="button" aria-expanded="false" aria-controls="accPanel">נגישות</button>'+
    '<div class="access-panel" id="accPanel" role="dialog" aria-label="אפשרויות נגישות">'+
     '<button type="button" data-a="font" aria-pressed="false">גודל טקסט: 100%</button>'+
     '<button type="button" data-a="contrast" aria-pressed="false">ניגודיות גבוהה</button>'+
     '<button type="button" data-a="readable" aria-pressed="false">גופן קריא</button>'+
     '<button type="button" data-a="motion" aria-pressed="false">עצירת אנימציות</button>'+
     '<button type="button" data-a="links" aria-pressed="false">הדגשת קישורים</button>'+
     '<button type="button" data-a="reset">איפוס הגדרות</button>'+
    '</div>'+
   '</div>')
 }

 const btn=el("#accBtn"),panel=el("#accPanel");
 const textSelector="h1,h2,h3,h4,h5,h6,p,a,button,label,input,select,textarea,li,td,th,small,strong,.small,.lead,.price,.eyebrow,.tag,.review-stars,.footer-tagline";
 let fs=Math.max(100,Math.min(130,Number(localStorage.rt_font||100)||100));

 function restoreOriginalFont(node){
  if(!node?.hasAttribute?.("data-rt-a11y-font"))return;
  const original=node.getAttribute("data-rt-a11y-font");
  if(original)node.style.fontSize=original;else node.style.removeProperty("font-size");
  node.removeAttribute("data-rt-a11y-font")
 }
 function scaleTextNode(node){
  if(fs===100){restoreOriginalFont(node);return}
  if(!node?.matches?.(textSelector))return;
  if(!node.hasAttribute("data-rt-a11y-font"))node.setAttribute("data-rt-a11y-font",node.style.fontSize||"");
  const original=node.getAttribute("data-rt-a11y-font");
  if(original)node.style.fontSize=original;else node.style.removeProperty("font-size");
  const base=parseFloat(getComputedStyle(node).fontSize);
  if(Number.isFinite(base)&&base>0)node.style.fontSize=(base*fs/100).toFixed(2)+"px"
 }
 function applyFontScale(){
  document.querySelectorAll(textSelector).forEach(scaleTextNode);
  document.documentElement.dataset.a11yFont=String(fs)
 }
 function syncA11yButtons(){
  const map={contrast:"high-contrast",readable:"readable",motion:"no-motion",links:"links-highlight"};
  panel?.querySelectorAll("button[data-a]").forEach(b=>{
   const k=b.dataset.a;
   if(k==="font"){
    b.textContent="גודל טקסט: "+fs+"%";
    b.setAttribute("aria-pressed",fs>100?"true":"false");
    b.classList.toggle("active",fs>100);
    return
   }
   if(k==="reset")return;
   const on=body.classList.contains(map[k]);
   b.setAttribute("aria-pressed",on?"true":"false");
   b.classList.toggle("active",on)
  })
 }

 btn?.addEventListener("click",()=>{
  const open=!panel.classList.contains("open");
  panel.classList.toggle("open",open);
  btn.setAttribute("aria-expanded",open?"true":"false");
  if(open)panel.querySelector("button")?.focus()
 });

 ["contrast","readable","motion","links"].forEach(k=>{
  if(localStorage["rt_"+k]==="1"){
   body.classList.add(k==="contrast"?"high-contrast":k==="motion"?"no-motion":k==="links"?"links-highlight":"readable")
  }
 });
 applyFontScale();
 syncA11yButtons();

 panel?.addEventListener("click",e=>{
  const control=e.target.closest("button[data-a]");if(!control)return;
  const k=control.dataset.a;
  if(k==="font"){
   fs=fs>=130?100:fs+10;
   localStorage.rt_font=String(fs);
   applyFontScale();
   syncA11yButtons();
   return
  }
  if(k==="reset"){
   ["rt_contrast","rt_readable","rt_motion","rt_links","rt_font"].forEach(x=>localStorage.removeItem(x));
   ["high-contrast","readable","no-motion","links-highlight"].forEach(cls=>body.classList.remove(cls));
   fs=100;applyFontScale();syncA11yButtons();
   return
  }
  const cls=k==="contrast"?"high-contrast":k==="motion"?"no-motion":k==="links"?"links-highlight":"readable";
  body.classList.toggle(cls);
  localStorage["rt_"+k]=body.classList.contains(cls)?"1":"0";
  syncA11yButtons()
 });

 document.addEventListener("click",e=>{
  if(!panel?.classList.contains("open"))return;
  if(e.target.closest(".access"))return;
  panel.classList.remove("open");btn?.setAttribute("aria-expanded","false")
 });
 document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&panel?.classList.contains("open")){
   panel.classList.remove("open");btn?.setAttribute("aria-expanded","false");btn?.focus()
  }
 });

 let resizeTimer;
 window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(applyFontScale,120)});

 const observer=new MutationObserver(mutations=>{
  if(fs===100)return;
  mutations.forEach(m=>m.addedNodes.forEach(node=>{
   if(node.nodeType!==1)return;
   scaleTextNode(node);
   node.querySelectorAll?.(textSelector).forEach(scaleTextNode)
  }))
 });
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
 root.innerHTML=rows.map(p=>'<article class="card">'+(p.images?.[0]?'<img src="'+p.images[0]+'" alt="'+esc(p.name)+'">':'<div class="ph" role="img" aria-label="'+esc(p.name)+'"></div>')+'<div class="card-body"><div>'+((p.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join(""))+'</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.short)+'</p><div class="price">'+money(p.salePrice||p.price)+(p.salePrice?'<span class="old">'+money(p.price)+'</span>':"")+'</div><div class="small">מלאי: '+p.stock+' · '+esc(p.fur)+' · '+p.height+' ס״מ</div><div class="actions"><a class="btn" href="product.html?id='+encodeURIComponent(p.id)+'">לצפייה והזמנה</a><a class="btn secondary" target="_blank" rel="noopener" href="'+esc(whatsappLink("שלום, אשמח לפרטים על "+p.name))+'">שאל ב-WhatsApp</a></div></div></article>').join("")||'<p>לא נמצאו מוצרים.</p>'
}
document.addEventListener("DOMContentLoaded",()=>{ensureRuntimeFavicon();applySiteSettings();injectGlobal();["search","category","court"].forEach(id=>el("#"+id)?.addEventListener("input",renderCatalog));renderCatalog();setupHomeReviewForm();el("#homeReviewSubmit")?.addEventListener("submit",submitHomeReview);el("#openReviewModal")?.addEventListener("click",openHomeReviewModal);el("#closeHomeReviewModal")?.addEventListener("click",closeHomeReviewModal);el("#cancelHomeReviewModal")?.addEventListener("click",closeHomeReviewModal);el("#homeReviewModal")?.addEventListener("click",e=>{if(e.target.id==="homeReviewModal")closeHomeReviewModal()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHomeReviewModal()})});