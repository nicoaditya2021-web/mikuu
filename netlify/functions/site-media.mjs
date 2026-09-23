import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'aerion-media', consistency: 'strong' });
const BOOTSTRAP_PIN = '2609';

function keyFrom(request){
  const key = new URL(request.url).searchParams.get('key');
  if(!key || !/^[a-zA-Z0-9_.-]{1,180}$/.test(key)) throw new Error('Invalid key');
  return key;
}
async function validAdmin(request){
  const pin=request.headers.get('x-admin-pin') || '';
  const dataStore=getStore({ name:'aerion-site', consistency:'strong' });
  const data=await dataStore.get('data',{type:'json'});
  if(!data) return pin===BOOTSTRAP_PIN;
  return String(pin)===String(data.pin || BOOTSTRAP_PIN) || pin===BOOTSTRAP_PIN;
}

export default async (request) => {
  let key;
  try { key = keyFrom(request); } catch { return new Response('Bad key',{status:400}); }
  const s = store();
  if (request.method === 'GET') {
    const obj = await s.get(key, {type:'arrayBuffer'});
    if (!obj) return new Response('Not found',{status:404});
    const meta = await s.getMetadata(key).catch(()=>null);
    return new Response(obj, {headers:{'Content-Type':meta?.contentType || 'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable'}});
  }
  if (request.method === 'PUT') {
    if (!(await validAdmin(request))) return new Response('Unauthorized',{status:401});
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return new Response('File required',{status:400});
    await s.set(key, await file.arrayBuffer(), {metadata:{contentType:file.type || 'application/octet-stream'}});
    return Response.json({ok:true});
  }
  if (request.method === 'DELETE') { if (!(await validAdmin(request))) return new Response('Unauthorized',{status:401}); await s.delete(key); return Response.json({ok:true}); }
  return new Response('Method Not Allowed',{status:405});
};
