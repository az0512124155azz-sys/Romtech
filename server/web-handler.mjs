// Adapter for hosts using the standard Request/Response interface (e.g. Netlify).
export function webHandler(app) {
  return async (request, context = {}) => {
    let body;
    if(request.method==='POST') {
      const raw=await request.text();
      if(raw.length>3000000)return Response.json({error:{code:'too_large',message:'הבקשה גדולה מדי.'}},{status:413});
      try{body=JSON.parse(raw||'{}')}catch{return Response.json({error:{code:'invalid_json',message:'הבקשה אינה תקינה.'}},{status:400})}
    }
    const req={url:request.url,method:request.method,headers:Object.fromEntries(request.headers),body,socket:{remoteAddress:context.ip||'unknown'}};
    let content='';const headers=new Headers();
    const res={statusCode:200,setHeader(name,value){headers.set(name,value)},end(value){content=value||''}};
    await app(req,res);
    return new Response(content,{status:res.statusCode,headers});
  };
}
