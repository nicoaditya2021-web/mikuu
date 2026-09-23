const STORAGE="aerion_linktree_v43";
const DB_NAME="AerionLinktreeMediaV42", STORE="media";
const defaults={pin:"2609",name:"Aerion",handle:"@aerion",bio:"Welcome to my little corner on the internet.",showTitle:"My favorite things",showLabel:"NOW PLAYING",accent:"#8f86ff",accent2:"#f09dc7",duration:3200,volume:.7,musicMode:"afterload",musicPlaylist:[],musicIndex:0,avatarSize:96,profileTop:0,avatarShape:"circle",bgPosition:"center center",bgSize:"cover",bgBlur:0,bgDarkness:42,bgMotion:"none",buttonStyle:"ios",buttonRadius:22,buttonGlass:.14,showSkills:true,skillsTitle:"SKILLS",skills:[],tiktokEnabled:false,tiktokTitle:"TikTok Terbaru",tiktokUsername:"",tiktokMode:"creator",tiktokPosition:"bottom-right",tiktokSize:"compact",tiktokFloat:true,tiktokRotate:true,avatar:false,background:false,backgroundVideo:false,loaderImage:false,loaderBackground:false,showImage:false,music:false,links:[{title:"Aerion Anime",subtitle:"Watch & explore",url:"",icon:false},{title:"Minecraft",subtitle:"Packs & projects",url:"",icon:false},{title:"Discord",subtitle:"Join the community",url:"",icon:false}]};
let data=loadData(), db, dbPromise=null, urls={}, musicReadyPromise=null, musicObjectURL=null, currentMusicIndex=0, pendingMusicFiles=[];
const $=id=>document.getElementById(id);

function loadData(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE));return x?{...structuredClone(defaults),...x,links:Array.isArray(x.links)?x.links:structuredClone(defaults.links),skills:Array.isArray(x.skills)?x.skills:[]}:structuredClone(defaults)}catch{return structuredClone(defaults)}
}
let remoteReady=false, remoteInitialized=false;
async function loadRemoteData(){
 try{
   const r=await fetch("/api/site-data",{cache:"no-store"});
   if(!r.ok)throw new Error("Server data "+r.status);
   const j=await r.json();
   remoteInitialized=!!j.initialized;
   if(j.data){data={...structuredClone(defaults),...j.data,links:Array.isArray(j.data.links)?j.data.links:structuredClone(defaults.links),skills:Array.isArray(j.data.skills)?j.data.skills:[]};
     localStorage.setItem(STORAGE,JSON.stringify(data));
   }
   remoteReady=true;
   if(!remoteInitialized){
     const localRaw=localStorage.getItem(STORAGE);
     if(localRaw){
       try{
         const local=JSON.parse(localRaw);
         data={...structuredClone(defaults),...local,links:Array.isArray(local.links)?local.links:structuredClone(defaults.links),skills:Array.isArray(local.skills)?local.skills:[]};
         await saveData();
         try{
           const database=db||await openDB();
           const entries=await new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readonly");const st=tx.objectStore(STORE);const r=st.getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
           const keys=await new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readonly");const st=tx.objectStore(STORE);const r=st.getAllKeys();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
           for(let i=0;i<entries.length;i++){if(keys[i]&&entries[i]){try{await remoteMedia(String(keys[i]),"PUT",entries[i])}catch(e){console.warn("Media migration failed",keys[i],e)}}}
         }catch(e){console.warn("Local media migration skipped",e)}
       }catch(e){console.warn("Local data migration skipped",e)}
     }
   }
   return true;
 }catch(e){console.warn("Remote data unavailable; using local fallback",e);remoteReady=false;return false}
}
async function saveData(){
 localStorage.setItem(STORAGE,JSON.stringify(data));
 if(!remoteReady)return;
 const r=await fetch("/api/site-data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data,pin:String(data.pin||"")})});
 if(r.status===401)throw new Error("PIN admin tidak cocok dengan PIN di server. Buka ulang Admin dan gunakan PIN yang tersimpan di server.");
 if(!r.ok)throw new Error("Gagal menyimpan data ke server ("+r.status+")");
 remoteInitialized=true;
}
function openDB(){
 if(db)return Promise.resolve(db);
 if(dbPromise)return dbPromise;
 if(!window.indexedDB)return Promise.reject(new Error("IndexedDB tidak tersedia"));
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onsuccess=()=>{db=req.result;db.onclose=()=>{db=null;dbPromise=null};resolve(db)};
  req.onerror=()=>{dbPromise=null;reject(req.error||new Error("Gagal membuka database"))};
 });
 return dbPromise;
}
async function remoteMedia(key,method="GET",file=null){
 const url="/api/site-media?key="+encodeURIComponent(key);
 if(method==="GET"){
   const r=await fetch(url,{cache:"no-store"});
   if(r.status===404)return null;
   if(!r.ok)throw new Error("Media server "+r.status);
   return await r.blob();
 }
 const fd=new FormData(); if(file)fd.append("file",file,file.name||key);
 const headers={"X-Admin-PIN":String(data.pin||"")};
 const r=await fetch(url,{method,headers,body:method==="PUT"?fd:undefined});
 if(r.status===401)throw new Error("PIN admin tidak cocok dengan server. Muat ulang halaman Admin lalu coba lagi.");
 if(!r.ok)throw new Error("Media server "+r.status);
 return true;
}
async function putMedia(key,file){
 if(!file)return;
 if(remoteReady){try{return await remoteMedia(key,"PUT",file)}catch(e){console.warn("Remote media upload failed, local fallback",e)}}
 const database=db||await openDB();
 return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).put(file,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error("Gagal menyimpan media"));tx.onabort=()=>reject(tx.error||new Error("Penyimpanan media dibatalkan"))})
}
async function getMedia(key){
 if(remoteReady){try{const b=await remoteMedia(key,"GET");if(b)return b}catch(e){console.warn("Remote media read failed, local fallback",e)}}
 const database=db||await openDB();
 return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readonly");const r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error||new Error("Gagal membaca media"))})
}
async function delMedia(key){
 if(remoteReady){try{await remoteMedia(key,"DELETE");return true}catch(e){console.warn("Remote media delete failed, local fallback",e)}}
 const database=db||await openDB();
 return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error("Gagal menghapus media"))})
}
async function mediaURL(key){const blob=await getMedia(key);if(!blob)return null;if(urls[key])URL.revokeObjectURL(urls[key]);urls[key]=URL.createObjectURL(blob);return urls[key]}

function setImage(img,fallback,url){if(url){img.onload=()=>{img.hidden=false;fallback.hidden=true};img.onerror=()=>{img.hidden=true;fallback.hidden=false};img.hidden=true;img.src=url}else{img.removeAttribute("src");img.hidden=true;fallback.hidden=false}}
function clearLoaderVideo(video){if(!video)return;try{video.pause()}catch{};video.removeAttribute("src");video.hidden=true;try{video.load()}catch{}}
function setLoaderMedia(blob,img,video,fallback){
  if(!img||!fallback)return;
  if(!blob){img.removeAttribute("src");img.hidden=true;clearLoaderVideo(video);fallback.hidden=false;return}
  if(urls.loaderImage)URL.revokeObjectURL(urls.loaderImage);
  const url=urls.loaderImage=URL.createObjectURL(blob);
  const isVideo=(blob.type||"").toLowerCase().startsWith("video/");
  if(isVideo && video){
    img.removeAttribute("src");img.hidden=true;
    fallback.hidden=true;video.hidden=false;video.src=url;video.currentTime=0;
    video.play().catch(()=>{});
  }else{
    clearLoaderVideo(video);fallback.hidden=false;img.hidden=true;
    img.onload=()=>{img.hidden=false;fallback.hidden=true};
    img.onerror=()=>{img.hidden=true;fallback.hidden=false};
    img.src=url;
  }
}
function safeUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:"#"}catch{return "#"}}

async function render(){
 document.documentElement.style.setProperty("--accent",data.accent);
 document.documentElement.style.setProperty("--accent2",data.accent2);document.documentElement.style.setProperty("--btn-radius",(data.buttonRadius||22)+"px");document.documentElement.style.setProperty("--btn-glass",data.buttonGlass??.14);document.body.classList.remove("button-style-ios","button-style-glass","button-style-solid","button-style-minimal");document.body.classList.add("button-style-"+(data.buttonStyle||"ios"));
 document.documentElement.style.setProperty("--avatar-size",(data.avatarSize||96)+"px");
 document.documentElement.style.setProperty("--profile-top",(data.profileTop||0)+"px");
 $("name").textContent=data.name;$("handle").textContent=data.handle;$("bio").textContent=data.bio;$("showTitle").textContent=data.showTitle;$("showLabel").textContent=data.showLabel;$("footerName").textContent=data.name.toUpperCase();

 const bg=$("background"), video=$("backgroundVideo"), shade=$("background-shade");
 bg.style.backgroundPosition=data.bgPosition||"center center";
 bg.style.backgroundSize=data.bgSize||"cover";
 bg.style.filter=`blur(${data.bgBlur||0}px)`;
 bg.classList.remove("motion-float","motion-pan","motion-zoom");
 if(data.bgMotion&&data.bgMotion!=="none")bg.classList.add("motion-"+data.bgMotion);
 const dark=Math.max(0,Math.min(85,Number(data.bgDarkness??42)))/100;
 shade.style.background=`linear-gradient(rgba(8,7,11,${dark*.72}),rgba(8,7,11,${dark}))`;

 if(data.backgroundVideo){
   const vu=await mediaURL("backgroundVideo");
   if(vu){
     if(video.dataset.mediaKey!==vu){video.src=vu;video.dataset.mediaKey=vu}
     video.hidden=false; video.play().catch(()=>{});
     bg.style.backgroundImage="";
     bg.classList.remove("default");
   }
 }else{
   video.pause();video.removeAttribute("src");video.hidden=true;video.dataset.mediaKey="";
   const bgUrl=data.background?await mediaURL("background"):null;
   if(bgUrl){bg.style.backgroundImage=`url("${bgUrl}")`;bg.classList.remove("default")}
   else{bg.style.backgroundImage="";bg.classList.add("default")}
 }

 const avatar=$("avatarImage"), avatarWrap=avatar.closest(".avatar");
 avatarWrap.classList.remove("shape-circle","shape-rounded","shape-soft");
 avatarWrap.classList.add("shape-"+(data.avatarShape||"circle"));
 setImage(avatar,$("avatarFallback"),data.avatar?await mediaURL("avatar"):null);
 const loaderBgEl=$("loaderGameBg");
 if(loaderBgEl){
   const loaderBgUrl=data.loaderBackground?await mediaURL("loaderBackground"):null;
   if(loaderBgUrl){
     loaderBgEl.style.backgroundImage=`linear-gradient(180deg,rgba(9,10,16,.34),rgba(9,10,16,.62)), url("${loaderBgUrl}")`;
     loaderBgEl.classList.add("has-custom-loader-bg");
   }else{loaderBgEl.style.backgroundImage="";loaderBgEl.classList.remove("has-custom-loader-bg")}
 }
 const loaderBlob=data.loaderImage?await getMedia("loaderImage"):null;
 setLoaderMedia(loaderBlob,$("loaderImage"),$("loaderVideo"),$("loaderFallback"));
 setImage($("showImage"),$("showFallback"),data.showImage?await mediaURL("showImage"):null);

 const music=$("music");
 const musicDebug=$("musicDebug");
 const playlist=playlistItems();
 if(musicDebug)musicDebug.textContent=playlist.length?`Status musik: memuat ${playlist.length} lagu...`:"Status musik: belum ada";
 if(playlist.length){
   currentMusicIndex=Math.min(Math.max(0,Number(data.musicIndex)||0),playlist.length-1);
   try{await prepareMusic(currentMusicIndex);}
   catch(e){console.error("Music load error",e);if(musicDebug)musicDebug.textContent="Status musik: gagal memuat — coba MP3/M4A yang kompatibel";}
 }else if(music){
   music.pause(); setNowPlayingState(false); music.removeAttribute("src"); music.load(); musicReadyPromise=null;
 }

 const skillsBox=$("skills");skillsBox.innerHTML="";skillsBox.style.display=data.showSkills!==false?"":"none";if(data.showSkills!==false){const title=document.createElement("h2");title.className="skills-title";title.textContent=data.skillsTitle||"SKILLS";skillsBox.append(title);const list=document.createElement("div");list.className="skill-list";for(let i=0;i<(data.skills||[]).length;i++){const s=data.skills[i];const card=s.url?document.createElement("a"):document.createElement("div");card.className="skill-card";if(s.url){card.href=safeUrl(s.url);card.target="_blank";card.rel="noopener";card.setAttribute("aria-label",s.name||"Skill");}const icon=document.createElement("div");icon.className="skill-icon";icon.style.setProperty("--skill-outline",s.outline||data.accent);const u=s.icon?await mediaURL("skill_"+i):null;if(u){const im=new Image();im.src=u;icon.append(im)}else{const f=document.createElement("div");f.className="skill-icon-fallback";f.textContent=(s.name||"S")[0].toUpperCase();icon.append(f)}const info=document.createElement("div");info.className="skill-info";info.innerHTML=`<div class="skill-name"></div><div class="skill-level"></div><div class="skill-progress"><i></i></div>`;info.querySelector(".skill-name").textContent=s.name||"New Skill";info.querySelector(".skill-level").textContent=(s.level||"Advanced")+" · "+Math.round(Number(s.value||0))+"%";const bar=info.querySelector("i");bar.style.setProperty("--skill-value",Math.max(0,Math.min(100,Number(s.value||0)))+"%");bar.style.setProperty("--skill-color",s.color||data.accent);card.append(icon,info);list.append(card)}skillsBox.append(list)}
 const box=$("links");box.innerHTML="";
 for(let i=0;i<data.links.length;i++){
   const l=data.links[i]||{};
   if(l.type==="channelMenu"){
     const wrap=document.createElement("div");wrap.className="channel-menu";
     const btn=document.createElement("button");btn.type="button";btn.className="ios-link channel-trigger";btn.setAttribute("aria-expanded","false");
     const icon=document.createElement("div");icon.className="ios-icon";icon.textContent=(l.title||"S")[0].toUpperCase();
     const text=document.createElement("div");text.className="ios-text";const strong=document.createElement("strong");strong.textContent=l.title||"Saluran WA";const small=document.createElement("small");small.textContent=l.subtitle||"Pilih saluran";text.append(strong,small);
     const arrow=document.createElement("div");arrow.className="ios-arrow channel-chevron";arrow.textContent="⌄";btn.append(icon,text,arrow);
     const choices=document.createElement("div");choices.className="channel-choices";
     const items=Array.isArray(l.items)?l.items:[];
     items.forEach((item)=>{const a=document.createElement("a");a.className="channel-choice";a.href=safeUrl(item.url);if(item.url){a.target="_blank";a.rel="noopener"}a.textContent=item.title||"Link lainnya";choices.append(a)});
     btn.onclick=()=>{const open=wrap.classList.toggle("open");btn.setAttribute("aria-expanded",String(open));};
     wrap.append(btn,choices);box.append(wrap);continue;
   }
   const a=document.createElement("a");a.className="ios-link";a.href=safeUrl(l.url);if(l.url){a.target="_blank";a.rel="noopener"}const icon=document.createElement("div");icon.className="ios-icon";if(l.icon){const u=await mediaURL("link_"+i);if(u){const im=new Image();im.src=u;icon.append(im)}else icon.textContent=(l.title||"L")[0].toUpperCase()}else icon.textContent=(l.title||"L")[0].toUpperCase();const text=document.createElement("div");text.className="ios-text";const strong=document.createElement("strong");strong.textContent=l.title||"Untitled";const small=document.createElement("small");small.textContent=l.subtitle||"";text.append(strong,small);const arrow=document.createElement("div");arrow.className="ios-arrow";arrow.textContent="›";a.append(icon,text,arrow);box.append(a)
 }
 await renderTikTokSection();
 fillEditor();
}

function musicDisplayName(item){
 const raw=String(item?.name||"Musik").trim();
 return raw.replace(/\.[a-z0-9]{2,5}$/i,"")||"Musik";
}
function setNowPlayingState(playing){
 const card=document.querySelector(".now-playing");
 if(card)card.classList.toggle("is-playing",!!playing);
}
function animateNowPlayingChange(){
 const art=document.querySelector(".np-art"), info=document.querySelector(".np-info");
 [art,info].forEach(el=>{
   if(!el)return;
   el.classList.remove("track-changing");
   void el.offsetWidth;
   el.classList.add("track-changing");
   setTimeout(()=>el.classList.remove("track-changing"),700);
 });
}
function updateNowPlayingText(item,{animate=true}={}){
 const title=$("showTitle");
 if(title)title.textContent=musicDisplayName(item);
 if(animate)animateNowPlayingChange();
}
function updateMusicProgress(){
 const a=$("music"), bar=document.querySelector(".timeline span");
 if(!a||!bar)return;
 const d=Number(a.duration), t=Number(a.currentTime);
 const pct=Number.isFinite(d)&&d>0&&Number.isFinite(t)?Math.max(0,Math.min(100,(t/d)*100)):0;
 bar.style.width=pct+"%";
}
function playlistItems(){
 const list=Array.isArray(data.musicPlaylist)?data.musicPlaylist.filter(x=>x&&x.key):[];
 if(list.length)return list;
 return data.music?[{key:"music",name:"Musik 1"}]:[];
}
function musicCount(){return playlistItems().length}
async function updateMusicArtwork(item){
 const img=$("showImage"), fallback=$("showFallback"); if(!img||!fallback)return;
 try{
   if(item&&item.coverKey){const blob=await getMedia(item.coverKey);if(blob){const u=await mediaURL(item.coverKey);setImage(img,fallback,u);return}}
   setImage(img,fallback,data.showImage?await mediaURL("showImage"):null);
 }catch(e){console.warn("Artwork error",e);}
}
async function prepareMusic(index=currentMusicIndex){
 const music=$("music");
 const list=playlistItems();
 if(!music)throw new Error("Elemen musik tidak ditemukan");
 if(!list.length)throw new Error("Belum ada musik");
 index=((Number(index)||0)%list.length+list.length)%list.length;
 const item=list[index];
 updateNowPlayingText(item,{animate:true});
 await updateMusicArtwork(item);
 if(music.dataset.readyMusic==="1" && Number(music.dataset.musicIndex)===index) return true;
 if(musicReadyPromise) return musicReadyPromise;
 musicReadyPromise=(async()=>{
   const blob=await getMedia(item.key);
   if(!blob)throw new Error("File musik tidak ditemukan: "+item.name);
   music.pause();
   if(musicObjectURL) URL.revokeObjectURL(musicObjectURL);
   musicObjectURL=URL.createObjectURL(blob);
   music.dataset.readyMusic="0";
   music.dataset.musicIndex=String(index);
   music.src=musicObjectURL;
   music.volume=Math.max(0,Math.min(1,Number(data.volume??.7)));
   music.preload="auto";
   await new Promise((resolve,reject)=>{
     let done=false;
     const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);music.removeEventListener("loadedmetadata",ok);music.removeEventListener("canplay",ok);music.removeEventListener("error",bad);err?reject(err):resolve();};
     const ok=()=>finish();
     const bad=()=>finish(new Error(music.error?`Kode audio ${music.error.code}`:"Audio tidak didukung browser"));
     const timer=setTimeout(()=>finish(new Error("Audio terlalu lama dimuat")),10000);
     music.addEventListener("loadedmetadata",ok,{once:true});
     music.addEventListener("error",bad,{once:true});
     music.load();
   });
   music.dataset.readyMusic="1";
   currentMusicIndex=index; data.musicIndex=index;
   // IMPORTANT: duration is read directly from the uploaded audio metadata.
   // There is intentionally no 60-second cap or timer-based track switching.
   const rawDuration=Number(music.duration);
   const duration=Number.isFinite(rawDuration) && rawDuration>0 ? formatMusicTime(rawDuration) : "sedang membaca durasi…";
   const d=$("musicDebug"); if(d)d.textContent=`Status musik: siap ${index+1}/${list.length} • ${item.name||"Musik"} • durasi asli ${duration}`;
   return true;
 })();
 try{return await musicReadyPromise;}finally{musicReadyPromise=null;}
}
function formatMusicTime(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")}
async function playMusicIndex(index,fromGesture=false){
 await prepareMusic(index);
 const music=$("music");
 music.volume=Math.max(0,Math.min(1,Number(data.volume??.7)));
 await music.play();
 setNowPlayingState(true);
 updateMusicProgress();
 $("musicButton").textContent="Ⅱ";
 const d=$("musicDebug");if(d){const item=playlistItems()[currentMusicIndex];d.textContent=`Status musik: diputar ${currentMusicIndex+1}/${musicCount()} • ${item?.name||"Musik"}`}
 return true;
}
async function playNextMusic(fromGesture=false){
 const count=musicCount(); if(!count)return false;
 return playMusicIndex((currentMusicIndex+1)%count,fromGesture);
}
async function playMusicFromUserGesture(){return playMusicIndex(currentMusicIndex,true)}

async function renderTikTokSection(){
 const sec=$("tiktokSection"); if(!sec)return;
 const enabled=!!data.tiktokEnabled, username=(data.tiktokUsername||"").trim().replace(/^@/,"");
 sec.hidden=!enabled||!username; if(sec.hidden)return;
 const title=data.tiktokTitle||"TikTok Terbaru";
 $("tiktokTitle").textContent=title;
 const modalTitle=$("tiktokModalTitle"); if(modalTitle)modalTitle.textContent=title;
 const userLabel=$("tiktokUsernameLabel"); if(userLabel)userLabel.textContent=`@${username}`;
 sec.dataset.position=data.tiktokPosition||"bottom-right";
 sec.dataset.size=data.tiktokSize||"compact";
 sec.classList.toggle("is-floating",data.tiktokFloat!==false);
 const wrap=$("tiktokEmbedWrap"); if(!wrap)return;
 wrap.innerHTML="";
 const block=document.createElement("blockquote");
 block.className="tiktok-embed";
 block.setAttribute("cite",`https://www.tiktok.com/@${username}`);
 block.setAttribute("data-unique-id",username);
 block.setAttribute("data-embed-type","creator");
 block.style.maxWidth="605px";
 block.style.minWidth="288px";
 const a=document.createElement("a");
 a.href=`https://www.tiktok.com/@${username}`;
 a.target="_blank"; a.rel="noopener"; a.textContent=`@${username}`;
 block.appendChild(a); wrap.appendChild(block);
 const old=document.getElementById("tiktokEmbedScript"); if(old)old.remove();
 const script=document.createElement("script");
 script.id="tiktokEmbedScript"; script.async=true; script.src="https://www.tiktok.com/embed.js";
 script.onload=()=>{try{if(window.tiktokEmbed&&typeof window.tiktokEmbed.load==="function")window.tiktokEmbed.load();}catch(e){console.warn(e)}};
 script.onerror=()=>{wrap.innerHTML=`<a class="tiktok-fallback" target="_blank" rel="noopener" href="https://www.tiktok.com/@${username}">Buka TikTok @${username}</a>`;};
 document.body.appendChild(script);
 const promo=$("tiktokPromoButton"), modal=$("tiktokModal"), close=$("tiktokClose");
 const closeAd=$("tiktokPromoClose"), mini=$("tiktokPromoMini"), card=$("tiktokAdCard"), kicker=$("tiktokPromoKicker");
 const openModal=()=>{ if(!modal)return; modal.hidden=false; modal.setAttribute("aria-hidden","false"); document.body.classList.add("tiktok-open"); };
 const closeModal=()=>{ if(!modal)return; modal.hidden=true; modal.setAttribute("aria-hidden","true"); document.body.classList.remove("tiktok-open"); };
 if(promo){promo.onclick=openModal;}
 if(close)close.onclick=closeModal;
 if(modal){modal.querySelectorAll("[data-tiktok-close]").forEach(el=>el.onclick=closeModal);}
 if(closeAd&&mini&&card){
   closeAd.onclick=(ev)=>{ev.stopPropagation();card.hidden=true;mini.hidden=false;};
   mini.onclick=()=>{mini.hidden=true;card.hidden=false;};
 }
 if(kicker&&data.tiktokRotate!==false){
   const words=["VIDEO BARU","🔥 LIHAT SEKARANG","UPDATE TERBARU","FOLLOW & WATCH"]; let wi=0;
   clearInterval(window.__aerionTikTokPromoTimer);
   window.__aerionTikTokPromoTimer=setInterval(()=>{wi=(wi+1)%words.length;kicker.classList.remove("swap");void kicker.offsetWidth;kicker.textContent=words[wi];kicker.classList.add("swap");},4200);
 }
 document.onkeydown=(ev)=>{if(ev.key==="Escape"&&modal&&!modal.hidden)closeModal();};
}
function renderMusicTrackEditor(){
 const root=$("musicTrackEditor"); if(!root)return; root.innerHTML="";
 const existing=playlistItems();
 existing.forEach((item,i)=>{
   const c=document.createElement("div"); c.className="music-track-card"; c.dataset.kind="existing"; c.dataset.index=String(i);
   c.innerHTML=`<div class="music-track-row"><strong>${i+1}. ${item.name||"Musik"}</strong><button type="button" class="small-button remove-track">Hapus lagu</button></div><label>Gambar cover lagu ini (custom)<input class="track-cover" type="file" accept="image/*"></label><div class="track-cover-note">Cover akan berubah otomatis saat lagu ini diputar.</div>`;
   const coverInput=c.querySelector(".track-cover");
   const note=c.querySelector(".track-cover-note");
   if(item.coverKey) note.textContent="Cover tersimpan. Pilih gambar baru untuk mengganti.";
   coverInput.addEventListener("change",async e=>{
     const file=e.target.files?.[0]; if(!file)return;
     try{note.textContent="Menyimpan cover…";item.coverKey=item.coverKey||(`music_cover_${item.key}`);await putMedia(item.coverKey,file);saveData();note.textContent="Cover tersimpan ✓";if(currentMusicIndex===i){await updateMusicArtwork(item);animateNowPlayingChange();}}
     catch(err){console.error(err);note.textContent="Gagal menyimpan cover: "+(err?.message||"error");}
   });
   c.querySelector(".remove-track").onclick=async()=>{await delMedia(item.key);if(item.coverKey)await delMedia(item.coverKey);data.musicPlaylist.splice(i,1);data.music=!!data.musicPlaylist.length;data.musicIndex=0;saveData();renderMusicTrackEditor();updateMusicStatus();}; root.appendChild(c);
 });
 pendingMusicFiles.forEach((entry,i)=>{
   const c=document.createElement("div"); c.className="music-track-card"; c.dataset.kind="pending"; c.dataset.id=entry.id;
   c.innerHTML=`<div class="music-track-row"><strong>Baru ${i+1}. ${entry.file.name}</strong><button type="button" class="small-button remove-pending-track">Batalkan</button></div><label>Gambar cover lagu ini (custom)<input class="pending-cover" type="file" accept="image/*"></label><div class="track-cover-note">Belum tersimpan. Tekan Simpan setelah selesai menambah lagu.</div>`;
   c.querySelector(".pending-cover").addEventListener("change",e=>{entry.cover=e.target.files[0]||null});
   c.querySelector(".remove-pending-track").onclick=()=>{pendingMusicFiles=pendingMusicFiles.filter(x=>x.id!==entry.id);renderMusicTrackEditor();updateMusicStatus();}; root.appendChild(c);
 });
}
function updateMusicStatus(){const total=playlistItems().length+pendingMusicFiles.length; const el=$("musicStatus");if(el)el.textContent=total?`${playlistItems().length} lagu tersimpan${pendingMusicFiles.length?` + ${pendingMusicFiles.length} lagu siap ditambahkan`:""} • berganti otomatis setelah selesai`:"Belum ada musik";}
function addSelectedMusicFiles(){const input=$("inputMusic");const fs=input?[...input.files]:[];if(!fs.length){alert("Pilih lagu terlebih dahulu.");return}const seen=new Set([...playlistItems().map(x=>`${x.name}|${x.size||""}`),...pendingMusicFiles.map(x=>`${x.file.name}|${x.file.size}`)]);for(const file of fs){const sig=`${file.name}|${file.size}`;if(!seen.has(sig)){pendingMusicFiles.push({id:"pending_"+Date.now()+"_"+Math.random().toString(36).slice(2),file,cover:null});seen.add(sig)}}input.value="";renderMusicTrackEditor();updateMusicStatus();}

function fillEditor(){
 $("inputName").value=data.name;$("inputHandle").value=data.handle;$("inputBio").value=data.bio;$("inputShowTitle").value=data.showTitle;$("inputShowLabel").value=data.showLabel;$("inputAccent").value=data.accent;$("inputAccent2").value=data.accent2;$("inputDuration").value=data.duration;$("inputVolume").value=data.volume;
 $("inputAvatarSize").value=data.avatarSize||96;$("avatarSizeValue").textContent=(data.avatarSize||96)+" px";
 $("inputProfileTop").value=data.profileTop||0;$("profileTopValue").textContent=(data.profileTop||0)+" px";
 $("inputAvatarShape").value=data.avatarShape||"circle";
 const te=$("inputTikTokEnabled"); if(te){te.checked=!!data.tiktokEnabled;$("inputTikTokTitle").value=data.tiktokTitle||"TikTok Terbaru";$("inputTikTokUsername").value=data.tiktokUsername||"";const tp=$("inputTikTokPosition");if(tp)tp.value=data.tiktokPosition||"bottom-right";const ts=$("inputTikTokSize");if(ts)ts.value=data.tiktokSize||"compact";const tf=$("inputTikTokFloat");if(tf)tf.checked=data.tiktokFloat!==false;const tr=$("inputTikTokRotate");if(tr)tr.checked=data.tiktokRotate!==false;}
 $("inputBgPosition").value=data.bgPosition||"center center";$("inputBgSize").value=data.bgSize||"cover";$("inputBgBlur").value=data.bgBlur||0;$("bgBlurValue").textContent=(data.bgBlur||0)+" px";$("inputBgDarkness").value=data.bgDarkness??42;$("bgDarknessValue").textContent=(data.bgDarkness??42)+"%";$("inputBgMotion").value=data.bgMotion||"none";$("inputMusicMode").value=data.musicMode||"afterload";pendingMusicFiles=[];renderMusicTrackEditor();updateMusicStatus();
 $("durationValue").textContent=(data.duration/1000).toFixed(1)+" detik";$("volumeValue").textContent=Math.round(data.volume*100)+"%";if($("inputShowSkills")){ $("inputShowSkills").checked=data.showSkills!==false;$("inputSkillsTitle").value=data.skillsTitle||"SKILLS";renderSkillEditor()}renderLinkEditor()
}
function renderLinkEditor(){
 const root=$("linkEditor");root.innerHTML="";
 data.links.forEach((l,i)=>{
   const c=document.createElement("div");c.className="link-edit";
   const isMenu=l.type==="channelMenu";
   if(isMenu){
     const items=Array.isArray(l.items)?l.items:[];
     c.innerHTML=`<div class="link-edit-top"><strong>Menu Saluran ${i+1}</strong><button type="button" class="remove-link">Hapus</button></div><label>Judul menu<input data-field="title"></label><label>Subjudul<input data-field="subtitle"></label><div class="channel-edit-items"></div>`;
     c.querySelector('[data-field="title"]').value=l.title||"Saluran WA";c.querySelector('[data-field="subtitle"]').value=l.subtitle||"Pilih saluran";
     const itemsRoot=c.querySelector('.channel-edit-items');
     items.forEach((item,j)=>{const row=document.createElement('div');row.className='channel-edit-item';row.innerHTML=`<strong>Link ${j+1}</strong><label>Nama<input data-item="title"></label><label>URL<input data-item="url" placeholder="https://..."></label>`;row.querySelector('[data-item="title"]').value=item.title||"";row.querySelector('[data-item="url"]').value=item.url||"";itemsRoot.append(row)});
   }else{
     c.innerHTML=`<div class="link-edit-top"><strong>Tombol ${i+1}</strong><button type="button" class="remove-link">Hapus</button></div><label>Judul<input data-field="title"></label><label>Subjudul<input data-field="subtitle"></label><label>URL<input data-field="url" placeholder="https://..."></label><label>Icon/gambar<input data-field="icon" type="file" accept="image/*"></label>`;
     c.querySelector('[data-field="title"]').value=l.title||"";c.querySelector('[data-field="subtitle"]').value=l.subtitle||"";c.querySelector('[data-field="url"]').value=l.url||"";
   }
   c.querySelector(".remove-link").onclick=async()=>{await delMedia("link_"+i);data.links.splice(i,1);renderLinkEditor()};root.append(c)
 })
}
function renderSkillEditor(){const root=$("skillEditor");if(!root)return;root.innerHTML="";(data.skills||[]).forEach((s,i)=>{const c=document.createElement("div");c.className="skill-edit";c.innerHTML=`<div class="skill-edit-top"><strong>Skill ${i+1}</strong><button type="button" class="remove-skill">Hapus</button></div><label>Nama<input data-field="name"></label><label>Level<input data-field="level" placeholder="Advanced"></label><label>Persentase<input data-field="value" type="number" min="0" max="100"></label><label>Link tujuan skill<input data-field="url" type="url" placeholder="https://..."></label><label>Foto/logo<input data-field="icon" type="file" accept="image/*"></label><label>Warna outline<input data-field="outline" type="color"></label><label>Warna progress<input data-field="color" type="color"></label>`;c.querySelector('[data-field="name"]').value=s.name||"";c.querySelector('[data-field="level"]').value=s.level||"Advanced";c.querySelector('[data-field="value"]').value=s.value??80;c.querySelector('[data-field="url"]').value=s.url||"";c.querySelector('[data-field="outline"]').value=s.outline||data.accent;c.querySelector('[data-field="color"]').value=s.color||data.accent;c.querySelector('.remove-skill').onclick=async()=>{await delMedia("skill_"+i);data.skills.splice(i,1);renderSkillEditor()};root.append(c)})}
$("addSkill")&&($("addSkill").onclick=()=>{data.skills.push({name:"New Skill",level:"Advanced",value:80,url:"",icon:false,outline:data.accent,color:data.accent});renderSkillEditor()});
function openEditor(){const editor=$("editor"),backdrop=$("editorBackdrop"); if(!editor)return; editor.classList.add("open"); if(backdrop)backdrop.classList.add("show"); document.body.classList.add("admin-open"); setTimeout(()=>{const first=document.querySelector(".admin-grid-nav .tab.active"); if(first)first.focus({preventScroll:true});},40)}
function closeEditor(){const editor=$("editor"),backdrop=$("editorBackdrop"); if(editor)editor.classList.remove("open"); if(backdrop)backdrop.classList.remove("show"); document.body.classList.remove("admin-open")}
const adminTrigger=$("adminButton");
function showPin(){const modal=$("pinModal"); if(!modal)return; $("pinInput").value="";$("pinMessage").textContent="";modal.classList.add("open"); setTimeout(()=>$("pinInput")?.focus(),80)}
if(adminTrigger){adminTrigger.addEventListener("click",showPin);adminTrigger.addEventListener("pointerup",e=>{if(e.pointerType!=="mouse")showPin()},{passive:true});}
$("pinCancel").onclick=()=>{$("pinModal").classList.remove("open")};
function unlockAdmin(){const input=$("pinInput"),msg=$("pinMessage");const entered=(input.value||"").trim();if(entered===String(data.pin)){msg.textContent="";$("pinModal").classList.remove("open");openEditor()}else{msg.textContent="PIN salah.";input.focus();input.select()}}
$("pinOpen").onclick=unlockAdmin;
$("pinInput").addEventListener("keydown",e=>{if(e.key==="Enter")unlockAdmin()});$("editorClose").onclick=()=>{closeEditor()};$("editorBackdrop").onclick=closeEditor;
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 const id=b.dataset.page, target=$(id);
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
 document.querySelectorAll(".editor-page").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 if(target)target.classList.add("active");
});
$("addLink").onclick=()=>{data.links.push({title:"New Link",subtitle:"Description",url:"",icon:false});renderLinkEditor()};
$("addChannelMenu")&&($("addChannelMenu").onclick=()=>{data.links.push({type:"channelMenu",title:"Saluran WA",subtitle:"Pilih saluran",items:[{title:"Saluran texture pack",url:""},{title:"Saluran utama",url:""},{title:"Link lainnya",url:""},{title:"Link lainnya",url:""}]});renderLinkEditor()});
$("inputDuration").oninput=e=>$("durationValue").textContent=(+e.target.value/1000).toFixed(1)+" detik";
$("inputVolume").oninput=e=>{ $("volumeValue").textContent=Math.round(e.target.value*100)+"%"; const a=$("music"); if(a)a.volume=e.target.value; };
function preview(inputId,previewId){$(inputId).addEventListener("change",()=>{const f=$(inputId).files[0];$(previewId).textContent=f?`${f.name} (${Math.round(f.size/1024)} KB)`:"Belum ada gambar baru"})}
preview("inputShowImage","showPreview");preview("inputBackground","backgroundPreview");preview("inputBackgroundVideo","backgroundPreview");preview("inputLoaderImage","loaderPreview");preview("inputLoaderBackground","loaderBackgroundPreview");
$("inputAvatarSize").oninput=e=>{$("avatarSizeValue").textContent=e.target.value+" px";document.documentElement.style.setProperty("--avatar-size",e.target.value+"px")};
$("inputProfileTop").oninput=e=>{$("profileTopValue").textContent=e.target.value+" px";document.documentElement.style.setProperty("--profile-top",e.target.value+"px")};
$("inputBgBlur").oninput=e=>{$("bgBlurValue").textContent=e.target.value+" px";$("background").style.filter=`blur(${e.target.value}px)`};
$("inputBgDarkness").oninput=e=>{$("bgDarknessValue").textContent=e.target.value+"%"};$("inputMusic").addEventListener("change",()=>{const fs=[...$("inputMusic").files];$("musicStatus").textContent=fs.length?`${fs.length} lagu dipilih • tekan Tambahkan lagu agar bisa memilih lagi`:"Pilih lagu untuk ditambahkan"});$("addMusicFiles")&&($("addMusicFiles").onclick=addSelectedMusicFiles);
async function clearMedia(key,flag){await delMedia(key);data[flag]=false;await saveData();if(!location.pathname.endsWith("admin.html"))await render();}
$("clearAvatar").onclick=()=>clearMedia("avatar","avatar");$("clearShowImage").onclick=()=>clearMedia("showImage","showImage");$("clearBackground").onclick=async()=>{await delMedia("background");await delMedia("backgroundVideo");data.background=false;data.backgroundVideo=false;await saveData();if(!location.pathname.endsWith("admin.html"))await render();};$("clearLoaderImage").onclick=()=>clearMedia("loaderImage","loaderImage");$("clearLoaderBackground").onclick=()=>clearMedia("loaderBackground","loaderBackground");$("clearMusic").onclick=async()=>{for(const item of playlistItems()){await delMedia(item.key);if(item.coverKey)await delMedia(item.coverKey)}await delMedia("music");pendingMusicFiles=[];data.music=false;data.musicPlaylist=[];data.musicIndex=0;await saveData();const a=$("music");if(a){a.pause();a.removeAttribute("src");a.load();a.dataset.readyMusic="0"}musicReadyPromise=null;currentMusicIndex=0;if(musicObjectURL){URL.revokeObjectURL(musicObjectURL);musicObjectURL=null}const b=$("musicButton");if(b)b.textContent="♪";if($("musicStatus"))$("musicStatus").textContent="Belum ada musik"};
$("saveButton").onclick=async()=>{
 const saveBtn=$("saveButton"); const oldText=saveBtn.textContent; saveBtn.disabled=true; saveBtn.textContent="Menyimpan...";
 try{
 data.name=$("inputName").value.trim()||"Aerion";data.handle=$("inputHandle").value.trim()||"@aerion";data.bio=$("inputBio").value.trim();data.showTitle=$("inputShowTitle").value.trim()||"My favorite things";data.showLabel=$("inputShowLabel").value.trim()||"NOW PLAYING";data.accent=$("inputAccent").value;data.accent2=$("inputAccent2").value;data.duration=+$("inputDuration").value;data.volume=+$("inputVolume").value;data.musicMode=$("inputMusicMode").value;
 const te=$("inputTikTokEnabled"); if(te){data.tiktokEnabled=te.checked;data.tiktokTitle=$("inputTikTokTitle").value.trim()||"TikTok Terbaru";data.tiktokUsername=$("inputTikTokUsername").value.trim().replace(/^@/,"");data.tiktokMode="creator";const tp=$("inputTikTokPosition");if(tp)data.tiktokPosition=tp.value;const ts=$("inputTikTokSize");if(ts)data.tiktokSize=ts.value;const tf=$("inputTikTokFloat");if(tf)data.tiktokFloat=tf.checked;const tr=$("inputTikTokRotate");if(tr)data.tiktokRotate=tr.checked;}data.avatarSize=+$("inputAvatarSize").value;data.profileTop=+$("inputProfileTop").value;data.avatarShape=$("inputAvatarShape").value;data.bgPosition=$("inputBgPosition").value;data.bgSize=$("inputBgSize").value;data.bgBlur=+$("inputBgBlur").value;data.bgDarkness=+$("inputBgDarkness").value;data.bgMotion=$("inputBgMotion").value;
 const mediaJobs=[];for(const [id,key,flag] of [["inputAvatar","avatar","avatar"],["inputShowImage","showImage","showImage"],["inputLoaderImage","loaderImage","loaderImage"],["inputLoaderBackground","loaderBackground","loaderBackground"]]){const f=$(id).files[0];if(f){data[flag]=true;mediaJobs.push(putMedia(key,f))}}await Promise.all(mediaJobs)
 // Simpan cover lagu yang sudah ada
 const existingTrackCards=[...document.querySelectorAll('.music-track-card[data-kind="existing"]')];
 for(const card of existingTrackCards){const i=Number(card.dataset.index), item=playlistItems()[i];const cover=card.querySelector('.track-cover')?.files?.[0];if(item&&cover){item.coverKey=item.coverKey||(`music_cover_${item.key}`);await putMedia(item.coverKey,cover);}}
 // Tambahkan lagu baru tanpa menghapus lagu lama (bisa pilih 1 per 1 atau banyak sekaligus)
 if(pendingMusicFiles.length){
   data.musicPlaylist=Array.isArray(data.musicPlaylist)?data.musicPlaylist:[];
   for(const entry of pendingMusicFiles){const key="music_"+Date.now()+"_"+Math.random().toString(36).slice(2);await putMedia(key,entry.file);const item={key,name:entry.file.name,size:entry.file.size,type:entry.file.type};if(entry.cover){item.coverKey="music_cover_"+key;await putMedia(item.coverKey,entry.cover);}data.musicPlaylist.push(item);}
   data.music=true;data.musicIndex=Math.min(Number(data.musicIndex)||0,data.musicPlaylist.length-1);currentMusicIndex=data.musicIndex;pendingMusicFiles=[];
   musicReadyPromise=null;if(musicObjectURL){URL.revokeObjectURL(musicObjectURL);musicObjectURL=null}
 }
 const videoFile=$("inputBackgroundVideo").files[0];
 if(videoFile){await putMedia("backgroundVideo",videoFile);data.backgroundVideo=true;data.background=false;await delMedia("background")}
 const imageFile=$("inputBackground").files[0];
 if(imageFile){await putMedia("background",imageFile);data.background=true;data.backgroundVideo=false;await delMedia("backgroundVideo")}
 const cards=[...document.querySelectorAll(".link-edit")];for(let i=0;i<cards.length;i++){const c=cards[i],l=data.links[i];l.title=c.querySelector('[data-field="title"]').value.trim()||"Untitled";l.subtitle=c.querySelector('[data-field="subtitle"]').value.trim();if(l.type==="channelMenu"){l.items=[...c.querySelectorAll('.channel-edit-item')].map(row=>({title:row.querySelector('[data-item="title"]').value.trim()||"Link lainnya",url:row.querySelector('[data-item="url"]').value.trim()}));}else{l.url=c.querySelector('[data-field="url"]').value.trim();const f=c.querySelector('[data-field="icon"]').files[0];if(f){await putMedia("link_"+i,f);l.icon=true}}}
 if($("inputShowSkills")){data.showSkills=$("inputShowSkills").checked;data.skillsTitle=$("inputSkillsTitle").value.trim()||"SKILLS";const skillCards=[...document.querySelectorAll(".skill-edit")];for(let i=0;i<skillCards.length;i++){const c=skillCards[i],s=data.skills[i];s.name=c.querySelector('[data-field="name"]').value.trim()||"New Skill";s.level=c.querySelector('[data-field="level"]').value.trim()||"Advanced";s.value=Math.max(0,Math.min(100,Number(c.querySelector('[data-field="value"]').value||0)));s.url=c.querySelector('[data-field="url"]')?.value.trim()||"";s.outline=c.querySelector('[data-field="outline"]').value;s.color=c.querySelector('[data-field="color"]').value;const f=c.querySelector('[data-field="icon"]').files[0];if(f){await putMedia("skill_"+i,f);s.icon=true}}} await saveData();if(!location.pathname.endsWith("admin.html")) await render(); else fillEditor();document.querySelectorAll('input[type="file"]').forEach(x=>x.value="");saveBtn.textContent="Tersimpan ✓";setTimeout(()=>saveBtn.textContent=oldText,900);if(!location.pathname.endsWith("admin.html"))closeEditor();
 }catch(e){console.error(e);alert("Gagal menyimpan media: "+(e&&e.message?e.message:"error"));saveBtn.textContent=oldText} finally {saveBtn.disabled=false}
};
$("changePin").onclick=async()=>{const old=prompt("PIN lama:");if(old!==String(data.pin)){alert("PIN salah.");return}const next=prompt("PIN baru:");if(next&&next.length>=4){data.pin=next;try{await saveData();alert("PIN berhasil diubah.")}catch(e){alert("Gagal menyimpan PIN ke server.")}}};
$("resetButton").onclick=async()=>{if(confirm("Reset semua pengaturan dan media?")){for(const k of ["avatar","background","backgroundVideo","loaderImage","loaderBackground","showImage","music",...playlistItems().flatMap(x=>[x.key,x.coverKey].filter(Boolean))]){await delMedia(k)} for(let i=0;i<(data.skills||[]).length;i++){ await delMedia("skill_"+i); } data=structuredClone(defaults);await saveData();if(!location.pathname.endsWith("admin.html"))await render();else fillEditor()}};
if($("musicButton")) $("musicButton").onclick=async()=>{
 const a=$("music");
 if(!musicCount()){alert("Belum ada musik. Upload melalui Admin → Musik lalu Simpan.");return}
 try{
   if(!a || a.paused){await playMusicFromUserGesture();}
   else{a.pause();setNowPlayingState(false);$("musicButton").textContent="♪";const d=$("musicDebug");if(d)d.textContent="Status musik: dijeda";}
 }catch(e){
   console.error("Music play error",e);
   const d=$("musicDebug");if(d)d.textContent="Status musik: gagal diputar — coba MP3 atau M4A yang kompatibel";
   alert("Musik gagal diputar. Upload ulang file MP3/M4A yang kompatibel. Detail: "+(e&&e.message?e.message:"error"));
 }
};

// Start music after the loader. No artificial track timer is used: the browser's
// native `ended` event controls when the next full song starts.
let firstTapMusicHandler=null;
function armMusicRecoveryTap(message){
 if(location.pathname.endsWith("admin.html") || !musicCount())return;
 if(firstTapMusicHandler)document.removeEventListener("pointerdown",firstTapMusicHandler,true);
 firstTapMusicHandler=async()=>{
   try{await playMusicIndex(currentMusicIndex,true);const d=$("musicDebug");if(d)d.textContent="Status musik: diputar setelah interaksi pertama ♪";}
   catch(e){console.warn("Music recovery error",e)}
   finally{document.removeEventListener("pointerdown",firstTapMusicHandler,true);firstTapMusicHandler=null;}
 };
 // Any first touch/click anywhere can recover Android/Chrome autoplay restrictions.
 document.addEventListener("pointerdown",firstTapMusicHandler,true);
 const d=$("musicDebug");if(d&&message)d.textContent=message;
}
async function tryAutoPlayAfterLoad(){
 if(!musicCount())return false;
 try{
   // Wait until the loader is completely gone and the public app is visible.
   await playMusicIndex(currentMusicIndex);
   const d=$("musicDebug");if(d)d.textContent="Status musik: sedang diputar otomatis setelah loading ♪";
   return true;
 }catch(e){
   console.warn("Autoplay diblokir atau gagal",e);
   // Browser policies can block unmuted autoplay. We cannot bypass that policy,
   // so immediately arm the first interaction as a reliable fallback.
   armMusicRecoveryTap("Status musik: browser meminta satu sentuhan untuk mulai — tap di mana saja");
   return false;
 }
}
function armFirstTapMusic(){
 if(location.pathname.endsWith("admin.html"))return;
 if(!musicCount())return;
 if(data.musicMode==="firsttap")armMusicRecoveryTap("Status musik: sentuh halaman untuk memulai musik");
}

// V4.21: do not hide the loader on unrelated runtime errors. The boot failsafe handles recovery safely.

// V4.27 music playback + real-duration fix.
// V4.20 game-style loading UI. Visual progress is driven by the selected loading duration.
let loadingGameTimer=null, loadingTipTimer=null, loadingGameStarted=0;
const loadingTips=[
 "Menyiapkan profil Aerion...",
 "Memuat link dan saluran...",
 "Menyinkronkan tampilan...",
 "Menyiapkan musik dan visual...",
 "Hampir siap memasuki profil..."
];
function startGameLoading(duration){
 const rootLoader=$("loader");
 if(rootLoader){rootLoader.classList.remove("hide","aerion-force-hide");rootLoader.style.display="grid";rootLoader.style.opacity="1";rootLoader.style.visibility="visible";}
 const bar=$("loadingProgress"), percent=$("loadingPercent"), tip=$("loadingTip");
 const total=Math.max(2500,Number(duration||data.duration||3200));
 loadingGameStarted=Date.now();
 if(loadingGameTimer)clearInterval(loadingGameTimer);
 if(loadingTipTimer)clearInterval(loadingTipTimer);
 let tipIndex=0;
 if(tip)tip.textContent=loadingTips[0];
 loadingGameTimer=setInterval(()=>{
   const elapsed=Date.now()-loadingGameStarted;
   const progress=Math.min(100,Math.round((elapsed/total)*100));
   if(bar)bar.style.width=progress+"%";
   if(percent)percent.textContent=progress+"%";
   if(progress>=100){clearInterval(loadingGameTimer);loadingGameTimer=null}
 },80);
 loadingTipTimer=setInterval(()=>{tipIndex=(tipIndex+1)%loadingTips.length;if(tip)tip.textContent=loadingTips[tipIndex]},Math.max(700,Math.round(total/4)));
}
function stopGameLoading(){
 if(loadingGameTimer){clearInterval(loadingGameTimer);loadingGameTimer=null}
 if(loadingTipTimer){clearInterval(loadingTipTimer);loadingTipTimer=null}
 const bar=$("loadingProgress"), percent=$("loadingPercent");
 if(bar)bar.style.width="100%";if(percent)percent.textContent="100%";
}

// V4.14 stable boot: never let the public page stay on LOADING forever.
function revealPublic(){
 stopGameLoading();
 const loader=$("loader"), app=$("app");
 if(app){app.classList.remove("app-hidden");app.classList.add("ready");app.style.visibility="visible";app.style.opacity="1"}
 if(loader){loader.classList.remove("hide");loader.classList.add("aerion-force-hide");setTimeout(()=>{loader.style.display="none"},720)}
 document.documentElement.classList.remove("aerion-loading");
}
function withTimeout(promise, ms, label){
 return Promise.race([
  promise,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(label||"timeout")),ms))
 ]);
}
async function bootApp(){
 const isAdmin=/\/admin\.html$/i.test(location.pathname);
 if(isAdmin){
   const loader=$("loader");
   if(loader){loader.classList.add("hide");loader.style.display="none"}
   await withTimeout(loadRemoteData(),5000,"Server data timeout");
   try{fillEditor()}catch(e){console.error(e)}
   const modal=$("pinModal"), input=$("pinInput"), msg=$("pinMessage");
   if(input)input.value=""; if(msg)msg.textContent=""; if(modal)modal.classList.add("open"); return;
 }
 const started=Date.now();
 startGameLoading(Math.max(2500,Number(data.duration||3200)));
 // Failsafe is longer than the chosen loading duration, so normal loading can
 // feel smooth without risking an infinite loading screen.
 const failsafe=setTimeout(()=>revealPublic(),Math.max(14000,Number(data.duration||3200)+7000));
 try{
   await withTimeout(loadRemoteData(),5000,"Server data timeout");
   await withTimeout(render(),7000,"Render timeout");
   armFirstTapMusic();
 }catch(e){ console.error("Public boot error",e); }
 finally{
   const minDuration=Math.max(2500,Number(data.duration||3200));
   const remaining=Math.max(0,minDuration-(Date.now()-started));
   if(remaining) await new Promise(resolve=>setTimeout(resolve,remaining));
   clearTimeout(failsafe); revealPublic();
   if(data.musicMode==="afterload") setTimeout(()=>{tryAutoPlayAfterLoad();},820);
 }
}
// The script is loaded at the end of body, so DOMContentLoaded is safer than
// window.load (which can wait for slow external resources on mobile networks).
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bootApp,{once:true});
else bootApp();

if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('reduce-motion')}

if($("music")){
 const musicEl=$("music");
 musicEl.addEventListener("ended",()=>{playNextMusic(false).catch(e=>{console.warn("Next music error",e);const d=$("musicDebug");if(d)d.textContent="Status musik: lagu berikutnya gagal diputar";});});
 musicEl.addEventListener("play",()=>{setNowPlayingState(true);updateMusicProgress();});
 musicEl.addEventListener("pause",()=>{if(!musicEl.ended)setNowPlayingState(false);});
 musicEl.addEventListener("timeupdate",updateMusicProgress);
 musicEl.addEventListener("loadedmetadata",updateMusicProgress);
 musicEl.addEventListener("ended",()=>{setNowPlayingState(false);updateMusicProgress();});
 musicEl.addEventListener("durationchange",()=>{
   const d=$("musicDebug"),dur=Number(musicEl.duration);
   if(d&&Number.isFinite(dur)&&dur>0&&musicEl.dataset.readyMusic==="1"){
     const item=playlistItems()[currentMusicIndex];
     d.textContent=`Status musik: ${currentMusicIndex+1}/${musicCount()} • ${item?.name||"Musik"} • durasi asli ${formatMusicTime(dur)}`;
   }
 });
 musicEl.addEventListener("error",()=>{
   const d=$("musicDebug");if(d)d.textContent="Status musik: file ini gagal diputar, mencoba lagu berikutnya…";
   setTimeout(()=>playNextMusic(false).catch(()=>{}),250);
 });
}
// Do not pause simply because the tab/app loses visibility; playback can continue
// while the page remains open (subject to the browser/OS itself).
window.addEventListener("pagehide",()=>{const a=$("music");if(a){a.pause();setNowPlayingState(false)}});
// V4.10: optional public-only listeners must never break the admin panel.
document.addEventListener("DOMContentLoaded",()=>{
 try{
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
   const target=$(b.dataset.page);
   document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
   document.querySelectorAll(".editor-page").forEach(x=>x.classList.remove("active"));
   b.classList.add("active");
   if(target)target.classList.add("active");
  });
 }catch(e){console.error(e)}
});

document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("pinModal")?.classList.contains("open"))$("pinModal").classList.remove("open");else if($("editor")?.classList.contains("open"))closeEditor();}});
window.addEventListener('load',()=>{if(location.hash==='#admin'){setTimeout(()=>{const m=document.getElementById('pinModal');if(m)m.classList.add('open')},900)}});
