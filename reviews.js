(()=>{
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stars=value=>{
 const n=Math.max(0,Math.min(5,Math.round(Number(value)||0)));
 return "★".repeat(n)+"☆".repeat(5-n)
};
function validReviews(){
 return (RomTechData.loadReviews?.()||[]).filter(r=>Number(r.rating)>=1&&Number(r.rating)<=5)
}
function renderSummary(rows){
 const avg=rows.length?rows.reduce((sum,r)=>sum+Number(r.rating||0),0)/rows.length:0;
 const avgEl=$("#reviewsAverage"),starsEl=$("#reviewsAverageStars"),countEl=$("#reviewsCount");
 if(avgEl)avgEl.textContent=rows.length?avg.toFixed(1):"—";
 if(starsEl){starsEl.textContent=rows.length?stars(avg):"☆☆☆☆☆";starsEl.setAttribute("aria-label",rows.length?("ממוצע "+avg.toFixed(1)+" מתוך 5"):"אין עדיין דירוגים")}
 if(countEl)countEl.textContent=rows.length?(rows.length+" ביקורות"):"אין עדיין ביקורות"
}
function renderReviews(){
 const rows=validReviews(),root=$("#allReviews");if(!root)return;
 renderSummary(rows);
 root.innerHTML=rows.length?rows.map(r=>
  '<article class="all-review-card">'+
    '<div class="all-review-card-head"><div><strong>'+esc(r.name||"לקוח")+'</strong><div class="all-review-product">'+esc(r.productName||"")+'</div></div>'+
    '<span class="review-stars" aria-label="'+Number(r.rating||0)+' מתוך 5">'+stars(r.rating)+'</span></div>'+
    '<p>'+esc(r.text||"")+'</p>'+
    '<div class="review-date">'+esc(r.createdAt?new Date(r.createdAt).toLocaleDateString("he-IL"):"")+'</div>'+
  '</article>'
 ).join(""):'<div class="reviews-empty"><strong>עדיין אין ביקורות.</strong><br>אפשר להיות הראשונים ולכתוב ביקורת למטה.</div>'
}
function fillProducts(){
 const select=$("#publicReviewProduct");if(!select)return;
 const products=RomTechData.loadProducts().filter(p=>p.status==="published");
 select.innerHTML=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
 const requested=new URLSearchParams(location.search).get("product");
 if(requested&&products.some(p=>p.id===requested))select.value=requested
}
function submitReview(e){
 e.preventDefault();
 const productId=$("#publicReviewProduct").value;
 const product=RomTechData.loadProducts().find(p=>p.id===productId);
 const name=$("#publicReviewName").value.trim();
 const text=$("#publicReviewText").value.trim();
 const rating=Number($("#publicReviewRating").value||5);
 if(!product||!name||!text)return;
 const rows=RomTechData.loadReviews?.()||[];
 rows.unshift({
  id:"rev-"+Date.now(),
  productId:product.id,
  productName:product.name,
  name,
  rating,
  text,
  status:"approved",
  createdAt:new Date().toISOString()
 });
 RomTechData.saveReviews(rows);
 e.currentTarget.reset();
 fillProducts();
 renderReviews();
 const message=$("#publicReviewMessage");
 if(message){message.textContent="תודה! הביקורת פורסמה באתר.";message.hidden=false}
 document.querySelector("#allReviewsTitle")?.scrollIntoView({behavior:"smooth",block:"start"})
}
document.addEventListener("DOMContentLoaded",()=>{
 fillProducts();
 renderReviews();
 $("#publicReviewForm")?.addEventListener("submit",submitReview)
});
})();