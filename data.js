const DEFAULT_PRODUCTS=[
{id:"rt-001",name:"שטריימל סאטמר קלאסי",short:"מראה קלאסי, מאוזן ומהודר בעבודת יד.",full:"שטריימל קלאסי בעבודת יד עם התאמה מדויקת, גימור מוקפד ונוחות ללבישה ממושכת.",court:"סאטמר",category:"קלאסי",price:6900,salePrice:6490,cost:3900,stock:6,lowStock:3,sku:"RT-SAT-001",barcode:"729000000001",height:14,teeth:18,fur:"סאבל",lining:"שחור",box:"קופסת עץ",embroidery:true,embroideryPrice:150,tags:["רב-מכר"],status:"published",seoTitle:"שטריימל סאטמר קלאסי | רוםטק",seoDescription:"שטריימל סאטמר קלאסי בעבודת יד ובגימור מוקפד.",slug:"shtreimel-satmar-classic",images:[]},
{id:"rt-002",name:"שטריימל בעלז מהודר",short:"נפח עשיר ומראה חגיגי במיוחד.",full:"דגם מהודר בסגנון בעלז, עם בחירת פרווה איכותית ועבודת גימור ידנית.",court:"בעלז",category:"מהודר",price:8200,salePrice:null,cost:4700,stock:3,lowStock:3,sku:"RT-BEL-002",barcode:"729000000002",height:16,teeth:22,fur:"מינק",lining:"כחול",box:"קופסת עור",embroidery:true,embroideryPrice:150,tags:["חדש"],status:"published",seoTitle:"שטריימל בעלז מהודר | רוםטק",seoDescription:"דגם בעלז מהודר, עבודת יד ופרווה איכותית.",slug:"shtreimel-belz-premium",images:[]},
{id:"rt-003",name:"ספודיק גור",short:"קו גבוה, אלגנטי ומדויק למסורת גור.",full:"ספודיק במבנה גבוה ומאוזן, מיוצר בהתאמה אישית לפי מידות הלקוח.",court:"גור",category:"ספודיק",price:7600,salePrice:7190,cost:4300,stock:4,lowStock:2,sku:"RT-GER-003",barcode:"729000000003",height:16,teeth:26,fur:"שועל",lining:"אפור",box:"קופסת עץ",embroidery:false,embroideryPrice:150,tags:["מבצע"],status:"published",seoTitle:"ספודיק גור | רוםטק",seoDescription:"ספודיק גור אלגנטי בהתאמה אישית.",slug:"spodik-ger",images:[]}
];

const DEFAULT_SITE_SETTINGS={
  phone:"+359 87 985 8846",
  whatsapp:"359879858846",
  email:"info@romtech.co.il",
  footerLabels:{
    accessibility:"הצהרת נגישות",
    cookies:"עוגיות",
    faq:"שאלות נפוצות",
    contact:"צור קשר",
    privacy:"פרטיות",
    terms:"תקנון",
    returns:"ביטולים והחזרות",
    shipping:"משלוחים"
  }
};

const DEFAULT_LEGAL_CONTENT={
  accessibility:{
    title:"הצהרת נגישות — רוםטק",
    body:'<p>אנו ברוםטק רואים חשיבות במתן שירות שוויוני ונגיש לכלל הציבור, לרבות אנשים עם מוגבלות.</p><h2>התאמות שבוצעו</h2><ul><li>ניווט באמצעות מקלדת</li><li>קישור דילוג לתוכן</li><li>מבנה כותרות מסודר</li><li>Labels ו-ARIA ברכיבים אינטראקטיביים</li><li>התאמה להגדלת טקסט</li><li>סרגל נגישות צף</li></ul><h2>יצירת קשר בנושא נגישות</h2><p>ניתן לפנות אלינו באמצעות פרטי הקשר המופיעים באתר.</p>'
  },
  privacy:{
    title:"מדיניות פרטיות — רוםטק",
    body:'<h2>איזה מידע אנו אוספים</h2><p>פרטים שמוזנים בטפסים, פרטי הזמנה ונתוני גלישה בהתאם להפעלת המערכת בפועל.</p><h2>מטרות השימוש</h2><p>עיבוד הזמנות, שירות לקוחות ושיווק רק במקום שבו ניתנה הסכמה מתאימה.</p><h2>זכויות משתמש</h2><p>ניתן לפנות לעיון, תיקון או מחיקה של מידע, בכפוף לדין החל.</p>'
  },
  terms:{
    title:"תקנון אתר",
    body:'<p>התקנון מסדיר שימוש באתר, רכישות, תשלום, משלוחים, ביטולים, החזרות, אחריות וקניין רוחני.</p><h2>רכישה ותשלום</h2><p>המחירים מוצגים בשקלים והזמנה באתר מהווה בקשת הזמנה עד לאישור סופי.</p><h2>משלוחים</h2><p>זמני ועלויות המשלוח מפורטים במדיניות המשלוחים.</p>'
  },
  returns:{
    title:"מדיניות ביטולים והחזרות",
    body:'<p>הזכאות לביטול או החזרה תלויה בדין ובסוג העסקה.</p><h2>מוצרים בהתאמה אישית</h2><p>מוצר שיוצר במיוחד עבור הלקוח עשוי להיות כפוף לחריגים מזכות ביטול.</p><h2>החזרת מוצר</h2><p>אופן ההחזרה, העלויות וזמן ההחזר הכספי ייקבעו בהתאם לעסקה ולדין החל.</p>'
  },
  shipping:{
    title:"מדיניות משלוחים",
    body:'<p>זמני ועלויות המשלוח משתנים בהתאם ליעד ולספק המשלוח.</p><h2>מעקב משלוח</h2><p>לאחר חיבור ספק שילוח, הזמנות מתאימות יקבלו מספר מעקב.</p>'
  },
  cookies:{
    title:"העדפות עוגיות",
    body:'<p>כאן ניתן לבחור אילו סוגי עוגיות לא הכרחיות יופעלו באתר.</p>'
  },
  faq:{
    title:"שאלות נפוצות",
    body:'<h2>איך בוחרים שטריימל?</h2><p>מתחילים בסגנון ובחצר, ולאחר מכן מתאימים גובה, סוג פרווה וגימור.</p><h2>האם קיימת התאמה אישית?</h2><p>כן. בהתאם לדגם ניתן לבחור מאפיינים ולהוסיף רקמת שם.</p><h2>איך מזמינים?</h2><p>נכנסים לדף המוצר ולוחצים על "הזמן עכשיו".</p>'
  },
  contact:{
    title:"צור קשר",
    body:'<p>נשמח לעזור בכל שאלה לגבי דגמים, התאמה אישית, הזמנות ומשלוחים.</p>'
  }
};

function normalizeWhatsAppNumber(value){
 let digits=String(value||"").replace(/\D/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 return digits
}
function buildWhatsAppLink(number,message=""){
 const digits=normalizeWhatsAppNumber(number);
 if(!digits)return "";
 const base="https://wa.me/"+digits;
 return message?base+"?text="+encodeURIComponent(message):base
}
function read(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function loadProducts(){return read("romtech_products",DEFAULT_PRODUCTS)}
function saveProducts(items){write("romtech_products",items)}
function loadOrders(){return read("romtech_orders",[])}
function saveOrders(items){write("romtech_orders",items)}
function loadReviews(){return read("romtech_reviews",[])}
function saveReviews(items){write("romtech_reviews",items)}
function loadSiteSettings(){
 const saved=read("romtech_site_settings",{});
 const merged={...DEFAULT_SITE_SETTINGS,...saved,footerLabels:{...DEFAULT_SITE_SETTINGS.footerLabels,...(saved.footerLabels||{})}};
 merged.whatsapp=normalizeWhatsAppNumber(merged.whatsapp);
 merged.whatsappUrl=buildWhatsAppLink(merged.whatsapp);
 return merged
}
function saveSiteSettings(settings){
 const next={...DEFAULT_SITE_SETTINGS,...settings,footerLabels:{...DEFAULT_SITE_SETTINGS.footerLabels,...(settings.footerLabels||{})}};
 next.whatsapp=normalizeWhatsAppNumber(next.whatsapp);
 next.whatsappUrl=buildWhatsAppLink(next.whatsapp);
 write("romtech_site_settings",next);
 return next
}
function loadLegalContent(){const saved=read("romtech_legal_content",{});const out={};Object.keys(DEFAULT_LEGAL_CONTENT).forEach(k=>out[k]={...DEFAULT_LEGAL_CONTENT[k],...(saved[k]||{})});return out}
function saveLegalContent(content){write("romtech_legal_content",content)}
window.RomTechData={loadProducts,saveProducts,loadOrders,saveOrders,loadReviews,saveReviews,normalizeWhatsAppNumber,buildWhatsAppLink,loadSiteSettings,saveSiteSettings,loadLegalContent,saveLegalContent,DEFAULT_PRODUCTS,DEFAULT_SITE_SETTINGS,DEFAULT_LEGAL_CONTENT};