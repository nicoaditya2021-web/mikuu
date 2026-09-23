import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'aerion-site', consistency: 'strong' });
const defaults = {
  pin: '2609', name:'Aerion', handle:'@aerion', bio:'Welcome to my little corner on the internet.',
  showTitle:'My favorite things', showLabel:'NOW PLAYING', accent:'#8f86ff', accent2:'#f09dc7', duration:3200,
  volume:.7, musicMode:'afterload', musicPlaylist:[], musicIndex:0, avatarSize:96, profileTop:0,
  avatarShape:'circle', bgPosition:'center center', bgSize:'cover', bgBlur:0, bgDarkness:42, bgMotion:'none',
  buttonStyle:'ios', buttonRadius:22, buttonGlass:.14, showSkills:true, skillsTitle:'SKILLS', skills:[],
  tiktokEnabled:false, tiktokTitle:'TikTok Terbaru', tiktokUsername:'', tiktokMode:'creator', tiktokPosition:'bottom-right',
  tiktokSize:'compact', tiktokFloat:true, tiktokRotate:true, avatar:false, background:false, backgroundVideo:false,
  loaderImage:false, loaderBackground:false, showImage:false, music:false,
  links:[{title:'Aerion Anime',subtitle:'Watch & explore',url:'',icon:false},{title:'Minecraft',subtitle:'Packs & projects',url:'',icon:false},{title:'Discord',subtitle:'Join the community',url:'',icon:false}]
};

const BOOTSTRAP_PIN = '2609';

export default async (request) => {
  const s = store();
  if (request.method === 'GET') {
    let data = await s.get('data', { type: 'json' });
    // Keep the server in a usable state if an older deployment left a
    // different/stale PIN behind. The user can change it again from Admin.
    if (!data) data = defaults;
    return Response.json({ initialized: !!data, data }, { headers: {'Cache-Control':'no-store'} });
  }
  if (request.method === 'POST') {
    const body = await request.json();
    const current = await s.get('data', { type: 'json' });
    const suppliedPin = String(body.pin ?? '');
    const currentPin = String(current?.pin ?? BOOTSTRAP_PIN);
    const allowed = !current || suppliedPin === currentPin || suppliedPin === BOOTSTRAP_PIN;
    if (!allowed) return Response.json({error:'PIN salah'}, {status:401});
    const incoming = body.data || {};
    const clean = {...defaults, ...incoming};
    // Bootstrap/recovery PIN is always accepted and becomes the canonical PIN
    // when used, allowing an old broken deployment to be recovered.
    if (suppliedPin === BOOTSTRAP_PIN && current && currentPin !== BOOTSTRAP_PIN) clean.pin = BOOTSTRAP_PIN;
    await s.setJSON('data', clean);
    return Response.json({ok:true});
  }
  return new Response('Method Not Allowed', {status:405});
};
