export const oauth = fetch('https://localhost:3000/api/oauth',{
    method:'GET',
    credentials :"include"}
).then((res)=>{ return res.status})