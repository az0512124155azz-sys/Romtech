(() => {
"use strict";
const $=q=>document.querySelector(q);

function renderManagedPage(){
 const key=document.body.dataset.legalPage;
 if(!key||!window.RomTechData)return;
 const all=RomTechData.loadLegalContent(),item=all[key]||{},settings=RomTechData.loadSiteSettings();
 const title=$("#managedTitle"),body=$("#managedBody"),contact=$("#managedContact");
 if(title)title.textContent=item.title||"";
 if(body)body.innerHTML=item.body||"";
 if(item.title)document.title=item.title+" | רוםטק";
 if(contact){
   if(["contact","accessibility","returns"].includes(key)){
     contact.hidden=false;
     contact.innerHTML='<h2>פרטי קשר</h2><p>טלפון: <a data-site-phone href="tel:'+String(settings.phone||"").replace(/\s/g,"")+'">'+(settings.phone||"")+'</a><br>אימייל: <a data-site-email href="mailto:'+(settings.email||"")+'">'+(settings.email||"")+'</a><br><a data-site-whatsapp target="_blank" rel="noopener" href="https://wa.me/'+String(settings.whatsapp||"").replace(/\D/g,"")+'">WhatsApp</a></p>'
   } else contact.hidden=true
 }
 if(typeof applySiteSettings==="function")applySiteSettings()
}

function bindCookies(){
 const form=$("#cookiePreferences");if(!form)return;
 let saved={};try{saved=JSON.parse(localStorage.rt_cookie||"{}")}catch{}
 ["analytics","marketing","functional"].forEach(k=>{const n=$("#"+k);if(n)n.checked=!!saved[k]});
 form.addEventListener("submit",e=>{e.preventDefault();localStorage.rt_cookie=JSON.stringify({essential:true,analytics:$("#analytics").checked,marketing:$("#marketing").checked,functional:$("#functional").checked,at:new Date().toISOString()});const m=$("#cookieSaved");m.hidden=false;setTimeout(()=>m.hidden=true,2200)})
}

function bindContact(){
 const form=$("#contactForm");if(!form)return;
 form.addEventListener("submit",e=>{e.preventDefault();const m=$("#contactSent");m.hidden=false;form.reset();setTimeout(()=>m.hidden=true,3500)})
}

document.addEventListener("DOMContentLoaded",()=>{renderManagedPage();bindCookies();bindContact()});
})();