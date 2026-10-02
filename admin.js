(() => {
function ensureAdminFavicon(){
 let link=document.querySelector('link[rel~="icon"]');
 if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link)}
 link.type="image/svg+xml";link.removeAttribute("sizes");link.href="../assets/favicon.svg?v=20261002-56";
}
"use strict";
const CREDENTIALS_KEY="rt_admin_credentials_v2";
const SESSION_KEY="rt_admin_ok";
let stagedImages=[];
const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=v=>new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:0}).format(Number(v||0));
const enc=v=>{try{return btoa(unescape(encodeURIComponent(v)))}catch{return v}};
const pageFiles={accessibility:"accessibility.html",privacy:"privacy.html",terms:"terms.html",returns:"returns.html",shipping:"shipping.html",cookies:"cookies.html",faq:"faq.html",contact:"contact.html"};

function getProducts(){return RomTechData.loadProducts()}
function saveProducts(v){RomTechData.saveProducts(v);renderAll()}
function getCredentials(){try{return JSON.parse(localStorage.getItem(CREDENTIALS_KEY))||null}catch{return null}}
function setCredentials(code,password){localStorage.setItem(CREDENTIALS_KEY,JSON.stringify({code:enc(code),password:enc(password)}))}
function validCredentials(code,password){const c=getCredentials();return !!c&&c.code===enc(code)&&c.password===enc(password)}
function refreshGate(){const text=$("#adminGateText");if(text)text.textContent=getCredentials()?"הזן קוד מנהל וסיסמה.":"בכניסה הראשונה הקוד והסיסמה שתבחר יישמרו בדפדפן הזה."}
function showAdmin(){if($("#adminGate")){$("#adminGate").hidden=true;$("#adminGate").style.display="none"}if($("#adminApp")){$("#adminApp").hidden=false;$("#adminApp").style.display="grid"}renderAll();loadSettingsForm();loadContentEditor()}
function showGate(){if($("#adminApp")){$("#adminApp").hidden=true;$("#adminApp").style.display="none"}if($("#adminGate")){$("#adminGate").hidden=false;$("#adminGate").style.display="grid"}refreshGate();setTimeout(()=>$("#adminCode")?.focus(),0)}
function enterAdmin(){
 const code=$("#adminCode")?.value.trim()||"",password=$("#adminPassword")?.value||"",err=$("#loginError");
 if(err)err.hidden=true;
 if(code.length<2||password.length<4){if(err){err.textContent="יש להזין קוד וסיסמה של לפחות 4 תווים.";err.hidden=false}return}
 if(!getCredentials()){setCredentials(code,password);sessionStorage.setItem(SESSION_KEY,"1");showAdmin();return}
 if(!validCredentials(code,password)){if(err){err.textContent="הקוד או הסיסמה שגויים.";err.hidden=false}return}
 sessionStorage.setItem(SESSION_KEY,"1");showAdmin()
}
function logout(){sessionStorage.removeItem(SESSION_KEY);showGate()}

const titles={dashboard:"Dashboard",orders:"הזמנות",products:"מוצרים",inventory:"מלאי",customers:"לקוחות",content:"תוכן",reviews:"ביקורות",reports:"דוחות",settings:"הגדרות"};
function go(name){$$(".admin-module").forEach(p=>p.classList.toggle("active",p.dataset.panel===name));$$(".side-link[data-module]").forEach(b=>b.classList.toggle("active",b.dataset.module===name));if($("#moduleTitle"))$("#moduleTitle").textContent=titles[name]||name;if(name==="orders")renderOrders();if(name==="inventory")renderInventory();if(name==="reviews")renderReviews();if(name==="reports")renderReports();if(name==="settings")loadSettingsForm();if(name==="content")loadContentEditor()}

function statusLabel(status){return status==="published"?"מפורסם":status==="draft"?"טיוטה":status==="hidden"?"מוסתר":status||""}
function updateBulkSelectionUI(){
 const checked=$$(".pick:checked"),all=$$(".pick"),count=$("#bulkSelectionCount"),apply=$("#bulkApply"),selectAll=$("#selectAllProducts");
 if(count)count.textContent=checked.length?checked.length+" מוצרים נבחרו":"לא נבחרו מוצרים";
 if(apply){apply.disabled=checked.length===0;apply.textContent=checked.length?("עדכן "+checked.length+" מוצרים נבחרים"):"עדכן מוצרים נבחרים"}
 all.forEach(box=>box.closest("tr")?.classList.toggle("selected",box.checked));
 if(selectAll){
  selectAll.checked=all.length>0&&checked.length===all.length;
  selectAll.indeterminate=checked.length>0&&checked.length<all.length
 }
}
function renderProducts(){
 const root=$("#adminRows");if(!root)return;
 root.innerHTML=getProducts().map(p=>'<tr><td><input type="checkbox" class="pick" value="'+esc(p.id)+'" aria-label="בחר '+esc(p.name)+'"></td><td>'+(p.images?.[0]?'<img class="admin-thumb" src="'+p.images[0]+'" alt="">':'<div class="admin-thumb empty"></div>')+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.category)+'</td><td>'+money(p.salePrice||p.price)+'</td><td>'+Number(p.stock||0)+(Number(p.stock||0)<=Number(p.lowStock||3)?' <span class="tag">נמוך</span>':'')+'</td><td>'+esc(statusLabel(p.status))+'</td><td><div class="row-actions"><button type="button" data-row-action="edit" data-id="'+esc(p.id)+'">עריכה</button><button type="button" data-row-action="duplicate" data-id="'+esc(p.id)+'">שכפול</button><button type="button" data-row-action="delete" data-id="'+esc(p.id)+'">מחיקה</button></div></td></tr>').join("");
 updateBulkSelectionUI()
}
function renderStats(){const ps=getProducts();if($("#count"))$("#count").textContent=ps.length;if($("#low"))$("#low").textContent=ps.filter(p=>Number(p.stock||0)<=Number(p.lowStock||3)).length;if($("#publishedCount"))$("#publishedCount").textContent=ps.filter(p=>p.status==="published").length}
function renderInventory(){const r=$("#inventoryList");if(!r)return;r.innerHTML=[...getProducts()].sort((a,b)=>Number(a.stock||0)-Number(b.stock||0)).map(p=>'<div class="admin-action-card"><b>'+esc(p.name)+'</b><span>מלאי: '+Number(p.stock||0)+'</span><span>'+(Number(p.stock||0)<=Number(p.lowStock||3)?"⚠ מלאי נמוך":"תקין")+'</span></div>').join("")||'<div class="empty-state">אין מוצרים.</div>'}
function renderReports(){const r=$("#reportCards"),ps=getProducts();if(!r)return;r.innerHTML='<div class="card card-body"><div class="small">שווי מלאי לפי עלות</div><div class="price">'+money(ps.reduce((s,p)=>s+Number(p.stock||0)*Number(p.cost||0),0))+'</div></div><div class="card card-body"><div class="small">יחידות במלאי</div><div class="price">'+ps.reduce((s,p)=>s+Number(p.stock||0),0)+'</div></div><div class="card card-body"><div class="small">טיוטות</div><div class="price">'+ps.filter(p=>p.status==="draft").length+'</div></div>'}
function renderOrders(){const r=$("#ordersRows");if(!r)return;const os=RomTechData.loadOrders();r.innerHTML=os.map(o=>'<tr><td>'+esc(o.id)+'</td><td>'+esc(o.createdAt?new Date(o.createdAt).toLocaleString("he-IL"):"")+'</td><td>'+esc(o.productName||"")+'</td><td>'+esc(o.customerName||"")+'</td><td><a href="tel:'+esc(o.phone||"")+'">'+esc(o.phone||"")+'</a></td><td>'+money(o.price||0)+'</td><td><select data-order-status="'+esc(o.id)+'"><option value="new"'+(o.status==="new"?" selected":"")+'>חדש</option><option value="contacted"'+(o.status==="contacted"?" selected":"")+'>נוצר קשר</option><option value="confirmed"'+(o.status==="confirmed"?" selected":"")+'>אושר</option><option value="completed"'+(o.status==="completed"?" selected":"")+'>הושלם</option><option value="cancelled"'+(o.status==="cancelled"?" selected":"")+'>בוטל</option></select></td><td><button type="button" data-delete-order="'+esc(o.id)+'">מחיקה</button></td></tr>').join("")||'<tr><td colspan="8"><div class="empty-state">עדיין אין הזמנות.</div></td></tr>'}
function renderReviews(){
 const root=$("#reviewsRows");if(!root)return;const rows=RomTechData.loadReviews?.()||[];
 root.innerHTML=rows.map(r=>'<tr><td>'+esc(r.createdAt?new Date(r.createdAt).toLocaleString("he-IL"):"")+'</td><td>'+esc(r.productName||"")+'</td><td>'+esc(r.name||"")+'</td><td><span class="review-stars">'+("★".repeat(Number(r.rating||0)))+'</span></td><td class="review-text-cell">'+esc(r.text||"")+'</td><td><button type="button" class="danger-link" data-review-action="delete" data-id="'+esc(r.id)+'">מחק</button></td></tr>').join("")||'<tr><td colspan="6"><div class="empty-state">עדיין לא נשלחו ביקורות.</div></td></tr>'
}
function deleteReview(id){if(!confirm("למחוק את הביקורת?"))return;RomTechData.saveReviews(RomTechData.loadReviews().filter(x=>x.id!==id));renderReviews()}
function renderAll(){renderProducts();renderStats();renderInventory();renderReports();renderOrders();renderReviews()}

function updateWhatsAppPreview(){
 const input=$("#settingWhatsapp"),link=$("#settingWhatsappLink"),box=$("#settingWhatsappGenerated");
 if(!input||!link)return;
 const phone=$("#settingPhone")?.value||RomTechData.loadSiteSettings().phone||"";
 const digits=RomTechData.normalizeWhatsAppNumber?RomTechData.normalizeWhatsAppNumber(input.value,phone):input.value.replace(/\D/g,"");
 const href=RomTechData.buildWhatsAppLink?RomTechData.buildWhatsAppLink(digits,"",phone):(digits?"https://api.whatsapp.com/send?phone="+digits:"");
 link.textContent=href||"יש להזין מספר WhatsApp עם קידומת מדינה";
 if(href){
  link.href=href;
  link.removeAttribute("aria-disabled");
  if(box)box.classList.remove("invalid")
 }else{
  link.removeAttribute("href");
  link.setAttribute("aria-disabled","true");
  if(box)box.classList.add("invalid")
 }
}
function loadSettingsForm(){
 const s=RomTechData.loadSiteSettings();
 if($("#settingPhone"))$("#settingPhone").value=s.phone||"";
 if($("#settingWhatsapp"))$("#settingWhatsapp").value=s.whatsapp||"";
 if($("#settingEmail"))$("#settingEmail").value=s.email||"";
 updateWhatsAppPreview();
 loadSettingsContentEditor()
}
function saveSiteSettings(){
 const input=$("#settingWhatsapp");
 const phone=$("#settingPhone")?.value.trim()||"";
 const digits=RomTechData.normalizeWhatsAppNumber?RomTechData.normalizeWhatsAppNumber(input?.value||"",phone):(input?.value||"").replace(/\D/g,"");
 if(digits.length<8||digits.length>15){alert("מספר WhatsApp חייב לכלול קידומת מדינה ולהכיל 8–15 ספרות.");return}
 const s=RomTechData.loadSiteSettings();
 s.phone=phone;
 s.whatsapp=digits;
 s.email=$("#settingEmail").value.trim();
 const saved=RomTechData.saveSiteSettings(s);
 if(input)input.value=saved.whatsapp;
 updateWhatsAppPreview();
 const notice=$("#siteSettingsSaved");
 if(notice)notice.textContent="פרטי הקשר נשמרו וקישור WhatsApp חדש נוצר.";
 showSaved("#siteSettingsSaved")
}
function setRichEditor(editorSelector,hiddenSelector,html){
 const editor=$(editorSelector),hidden=$(hiddenSelector),value=html||"";
 if(editor)editor.innerHTML=value;
 if(hidden)hidden.value=value
}
function sanitizeRichHtml(html){
 const doc=new DOMParser().parseFromString('<div>'+String(html||"")+'</div>',"text/html");
 doc.querySelectorAll("script,style,iframe,object,embed,form,input,button,textarea,select").forEach(n=>n.remove());
 doc.querySelectorAll("*").forEach(n=>{
  [...n.attributes].forEach(a=>{
   const name=a.name.toLowerCase(),value=String(a.value||"").trim().toLowerCase();
   if(name.startsWith("on")||name==="style"||name==="class"||name==="id")n.removeAttribute(a.name);
   if((name==="href"||name==="src")&&value.startsWith("javascript:"))n.removeAttribute(a.name)
  })
 });
 return doc.body.firstElementChild?.innerHTML||""
}
function readRichEditor(editorSelector,hiddenSelector){
 const editor=$(editorSelector),hidden=$(hiddenSelector),html=sanitizeRichHtml(editor?.innerHTML||"");
 if(editor)editor.innerHTML=html;
 if(hidden)hidden.value=html;
 return html
}
function runRichEditorAction(button){
 const editor=$("#"+button.dataset.editorTarget);if(!editor)return;
 editor.focus();
 const block=button.dataset.richBlock,command=button.dataset.richCommand;
 if(block){document.execCommand("formatBlock",false,"<"+block.toLowerCase()+">");return}
 if(command==="createLink"){
  const url=prompt("הכנס כתובת קישור:");
  if(url)document.execCommand("createLink",false,url);
  return
 }
 if(command)document.execCommand(command,false,null)
}
function loadSettingsContentEditor(){
 const select=$("#settingsContentPage");if(!select)return;
 const key=select.value||"accessibility",all=RomTechData.loadLegalContent(),item=all[key]||{title:"",body:""};
 $("#settingsContentTitle").value=item.title||"";
 setRichEditor("#settingsContentEditor","#settingsContentBody",item.body||"");
 $("#previewSettingsContent").href="../"+pageFiles[key]
}
function saveSettingsContent(){
 const key=$("#settingsContentPage").value,all=RomTechData.loadLegalContent();
 all[key]={title:$("#settingsContentTitle").value.trim(),body:readRichEditor("#settingsContentEditor","#settingsContentBody")};
 RomTechData.saveLegalContent(all);showSaved("#settingsContentSaved")
}
function saveAdminCredentials(){
 const code=$("#settingAdminCode").value.trim(),pass=$("#settingAdminPassword").value,confirmPass=$("#settingAdminPasswordConfirm").value;
 if(code.length<2||pass.length<4){alert("יש להזין קוד וסיסמה חדשה של לפחות 4 תווים.");return}
 if(pass!==confirmPass){alert("הסיסמאות אינן תואמות.");return}
 setCredentials(code,pass);$("#settingAdminCode").value="";$("#settingAdminPassword").value="";$("#settingAdminPasswordConfirm").value="";showSaved("#credentialsSaved")
}
function showSaved(sel){const n=$(sel);if(!n)return;n.hidden=false;setTimeout(()=>n.hidden=true,2200)}

function loadContentEditor(){
 const key=$("#contentPageSelect")?.value||"accessibility",all=RomTechData.loadLegalContent(),settings=RomTechData.loadSiteSettings(),item=all[key]||{title:"",body:""};
 if($("#contentTitle"))$("#contentTitle").value=item.title||"";
 setRichEditor("#contentEditor","#contentBody",item.body||"");
 if($("#contentFooterLabel"))$("#contentFooterLabel").value=settings.footerLabels?.[key]||"";
 if($("#previewContentPage"))$("#previewContentPage").href="../"+pageFiles[key]
}
function saveContent(){
 const key=$("#contentPageSelect").value,all=RomTechData.loadLegalContent(),settings=RomTechData.loadSiteSettings();
 all[key]={title:$("#contentTitle").value.trim(),body:readRichEditor("#contentEditor","#contentBody")};
 settings.footerLabels={...(settings.footerLabels||{}),[key]:$("#contentFooterLabel").value.trim()};
 RomTechData.saveLegalContent(all);RomTechData.saveSiteSettings(settings);showSaved("#contentSaved")
}

function openModal(product=null){const m=$("#productModal"),f=$("#productForm");if(!m||!f)return;f.reset();$("#pid").value="";stagedImages=[];if(product){$("#modalTitle").textContent="עריכת מוצר";Object.entries(product).forEach(([k,v])=>{const field=f.elements.namedItem(k);if(!field)return;if(field.type==="checkbox")field.checked=!!v;else if(Array.isArray(v))field.value=v.join(", ");else field.value=v??""});$("#pid").value=product.id;stagedImages=[...(product.images||[])]}else $("#modalTitle").textContent="הוסף שטריימל חדש";renderPreview();m.classList.add("open")}
function closeModal(){$("#productModal")?.classList.remove("open")}
function renderPreview(){const r=$("#imagePreview");if(r)r.innerHTML=stagedImages.map((x,i)=>'<div class="preview-item"><img src="'+x+'" alt=""><button type="button" data-remove-image="'+i+'">✕</button></div>').join("")}
function compressImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const max=1000,k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);resolve(c.toDataURL("image/webp",.78))};img.onerror=reject;img.src=u})}
async function addImages(files){for(const f of Array.from(files).slice(0,Math.max(0,10-stagedImages.length)))stagedImages.push(await compressImage(f));renderPreview()}
function saveProduct(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),o=Object.fromEntries(fd.entries());["price","salePrice","cost","stock","lowStock","height","teeth","embroideryPrice"].forEach(k=>o[k]=o[k]===""?null:Number(o[k]));o.embroidery=!!f.elements.namedItem("embroidery").checked;o.tags=String(o.tags||"").split(",").map(x=>x.trim()).filter(Boolean);o.images=[...stagedImages];o.id=$("#pid").value||"rt-"+Date.now();if(!o.slug)o.slug=String(o.name||"").toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g,"-").replace(/^-|-$/g,"");const ps=getProducts(),i=ps.findIndex(x=>x.id===o.id);if(i>=0)ps[i]={...ps[i],...o};else ps.push(o);saveProducts(ps);closeModal()}
function duplicateProduct(id){const p=getProducts().find(x=>x.id===id);if(p)saveProducts([...getProducts(),{...p,id:"rt-"+Date.now(),name:p.name+" — עותק",status:"draft",images:[...(p.images||[])]}])}
function deleteProduct(id){const p=getProducts().find(x=>x.id===id);if(p&&confirm('למחוק את "'+p.name+'"?'))saveProducts(getProducts().filter(x=>x.id!==id))}
function resetBulkFields(){
 ["bulkStatus","bulkCategory","bulkPrice","bulkStock"].forEach(id=>{const n=$("#"+id);if(n)n.value=""})
}
function bulk(){
 const ids=$$(".pick:checked").map(x=>x.value);
 if(!ids.length){alert("סמן לפחות מוצר אחד בטבלה.");return}
 const st=$("#bulkStatus").value,cat=$("#bulkCategory").value,price=$("#bulkPrice").value,stock=$("#bulkStock").value;
 if(!st&&!cat&&price===""&&stock===""){alert("בחר לפחות שינוי אחד: סטטוס, קטגוריה, מחיר או מלאי.");return}
 if(price!==""&&Number(price)<0){alert("מחיר לא יכול להיות שלילי.");return}
 if(stock!==""&&Number(stock)<0){alert("מלאי לא יכול להיות שלילי.");return}
 const changes=[];
 if(st)changes.push("סטטוס: "+statusLabel(st));
 if(cat)changes.push("קטגוריה: "+cat);
 if(price!=="")changes.push("מחיר חדש: "+money(Number(price))+" (מחליף את המחיר הקיים)");
 if(stock!=="")changes.push("מלאי: "+Number(stock));
 if(!confirm("לעדכן "+ids.length+" מוצרים?\n"+changes.join("\n")))return;
 const updated=getProducts().map(p=>ids.includes(p.id)?{...p,...(st?{status:st}:{}),...(cat?{category:cat}:{}),...(price!==""?{price:Number(price),salePrice:null}:{}),...(stock!==""?{stock:Number(stock)}:{})}:p);
 RomTechData.saveProducts(updated);
 renderAll();
 resetBulkFields();
 const m=$("#bulkMessage");
 if(m){m.textContent=ids.length+" מוצרים עודכנו בהצלחה.";m.hidden=false;setTimeout(()=>m.hidden=true,3000)}
}
function parseCsv(text){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue}
  if(ch==='"'){quoted=!quoted;continue}
  if(ch===","&&!quoted){row.push(cell);cell="";continue}
  if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&next==="\n")i++;
   row.push(cell);cell="";
   if(row.some(v=>v!==""))rows.push(row);
   row=[];continue
  }
  cell+=ch
 }
 row.push(cell);if(row.some(v=>v!==""))rows.push(row);
 return rows
}
async function importCsvFile(file){
 if(!file)return;
 const text=await file.text(),rows=parseCsv(text.replace(/^\uFEFF/,""));
 if(rows.length<2){alert("קובץ ה-CSV ריק או לא תקין.");return}
 const headers=rows[0].map(x=>x.trim()),required=["id","name","price","stock","status"];
 const missing=required.filter(x=>!headers.includes(x));
 if(missing.length){alert("חסרות עמודות חובה: "+missing.join(", "));return}
 const existing=new Map(getProducts().map(p=>[String(p.id),p]));
 let imported=0;
 for(const values of rows.slice(1)){
  const raw={};headers.forEach((h,i)=>raw[h]=values[i]??"");
  if(!raw.id||!raw.name)continue;
  const base=existing.get(String(raw.id))||{};
  const obj={...base,...raw};
  ["price","salePrice","cost","stock","lowStock","height","teeth","embroideryPrice"].forEach(k=>{if(raw[k]!==undefined&&raw[k]!=="")obj[k]=Number(raw[k])});
  if(raw.embroidery!==undefined)obj.embroidery=/^(true|1|yes|כן)$/i.test(String(raw.embroidery));
  if(raw.tags!==undefined)obj.tags=String(raw.tags||"").split("|").map(x=>x.trim()).filter(Boolean);
  existing.set(String(obj.id),obj);imported++
 }
 if(!imported){alert("לא נמצאו מוצרים תקינים לייבוא.");return}
 if(!confirm("לייבא ולעדכן "+imported+" מוצרים מהקובץ?"))return;
 RomTechData.saveProducts(Array.from(existing.values()));
 renderAll();
 alert(imported+" מוצרים יובאו בהצלחה.")
}
function exportCsv(){const cols=["id","name","short","full","court","category","price","salePrice","cost","stock","lowStock","sku","barcode","height","teeth","fur","lining","box","embroidery","embroideryPrice","tags","status","seoTitle","seoDescription","slug"],ps=getProducts(),cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"',csv=[cols.join(","),...ps.map(p=>cols.map(k=>cell(Array.isArray(p[k])?p[k].join("|"):p[k])).join(","))].join("\n"),u=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=u;a.download="romtech-products.csv";a.click();URL.revokeObjectURL(u)}
function updateOrderStatus(id,status){const os=RomTechData.loadOrders(),o=os.find(x=>x.id===id);if(o){o.status=status;RomTechData.saveOrders(os);renderOrders()}}
function deleteOrder(id){if(confirm("למחוק את ההזמנה?")){RomTechData.saveOrders(RomTechData.loadOrders().filter(x=>x.id!==id));renderOrders()}}

document.addEventListener("mousedown",e=>{const b=e.target.closest("[data-rich-command],[data-rich-block]");if(!b)return;e.preventDefault();runRichEditorAction(b)});
document.addEventListener("input",e=>{if(e.target.matches("#settingsContentEditor"))$("#settingsContentBody").value=e.target.innerHTML;if(e.target.matches("#contentEditor"))$("#contentBody").value=e.target.innerHTML});
document.addEventListener("DOMContentLoaded",()=>{ensureAdminFavicon();
 $("#adminSubmit")?.addEventListener("click",enterAdmin);["adminCode","adminPassword"].forEach(id=>$("#"+id)?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();enterAdmin()}}));$("#logoutBtn")?.addEventListener("click",logout);
 $$(".side-link[data-module]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.module)));$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
 $("#newBtn")?.addEventListener("click",()=>openModal());$('[data-action="new-product"]')?.addEventListener("click",()=>{go("products");openModal()});$("#closeModal")?.addEventListener("click",closeModal);$("#cancelModal")?.addEventListener("click",closeModal);$("#productForm")?.addEventListener("submit",saveProduct);$("#productImages")?.addEventListener("change",async e=>{await addImages(e.target.files);e.target.value=""});$("#bulkApply")?.addEventListener("click",bulk);$("#selectAllProducts")?.addEventListener("change",e=>{$(".pick").forEach(x=>x.checked=e.target.checked);updateBulkSelectionUI()});$("#importCsv")?.addEventListener("change",async e=>{const file=e.target.files?.[0];if(file)await importCsvFile(file);e.target.value=""});$("#exportCsv")?.addEventListener("click",exportCsv);$("#inventoryRefresh")?.addEventListener("click",renderInventory);$("#ordersRefresh")?.addEventListener("click",renderOrders);$("#reviewsRefresh")?.addEventListener("click",renderReviews);
 $("#saveSiteSettings")?.addEventListener("click",saveSiteSettings);$("#settingWhatsapp")?.addEventListener("input",updateWhatsAppPreview);$("#saveAdminCredentials")?.addEventListener("click",saveAdminCredentials);$("#settingsContentPage")?.addEventListener("change",loadSettingsContentEditor);$("#saveSettingsContent")?.addEventListener("click",saveSettingsContent);$("#contentPageSelect")?.addEventListener("change",loadContentEditor);$("#saveContent")?.addEventListener("click",saveContent);
 document.addEventListener("click",e=>{const a=e.target.closest("[data-row-action]");if(a){const id=a.dataset.id;if(a.dataset.rowAction==="edit"){const p=getProducts().find(x=>x.id===id);if(p)openModal(p)}if(a.dataset.rowAction==="duplicate")duplicateProduct(id);if(a.dataset.rowAction==="delete")deleteProduct(id)}const rm=e.target.closest("[data-remove-image]");if(rm){stagedImages.splice(Number(rm.dataset.removeImage),1);renderPreview()}const d=e.target.closest("[data-delete-order]");if(d)deleteOrder(d.dataset.deleteOrder);const ra=e.target.closest("[data-review-action]");if(ra&&ra.dataset.reviewAction==="delete")deleteReview(ra.dataset.id)});
 document.addEventListener("change",e=>{const s=e.target.closest("[data-order-status]");if(s)updateOrderStatus(s.dataset.orderStatus,s.value);if(e.target.matches(".pick"))updateBulkSelectionUI()});
 $("#reviewModal")?.addEventListener("click",e=>{if(e.target.id==="reviewModal")closeReviewModal()});
 refreshGate();if(sessionStorage.getItem(SESSION_KEY)==="1"&&getCredentials())showAdmin();else showGate()
});
})();