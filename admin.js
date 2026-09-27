const CONFIG = window.NHRP_CONFIG || {};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let db = null;
let session = null;
let rules = [];
let selectedId = null;
let editorItems = [];
let confirmResolver = null;
let settingsCache = {};
let verificationTimer = null;
let discordAccess = null;
const PROVIDER_TOKEN_KEY = "nhrp_rulebook_discord_provider_token";

function slugify(s){return (s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function esc(s){return (s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function validConfig(){return CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_URL.includes("YOUR-PROJECT") && !CONFIG.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")}
function todayLabel(){return new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
function setStatus(el,msg,type=""){el.textContent=msg||"";el.className="status-text"+(type?` ${type}`:"")}

async function init(){
  if(!validConfig() || !window.supabase){
    setStatus($("#loginStatus"),"Supabase is not configured yet. Open supabase-config.js and add your project URL and publishable key.","error");
    return;
  }
  db = window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
  bind();

  db.auth.onAuthStateChange((event,newSession)=>{
    if(newSession?.provider_token){
      sessionStorage.setItem(PROVIDER_TOKEN_KEY,newSession.provider_token);
    }
    if(event==="SIGNED_OUT"){
      sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
      setTimeout(showLogin,0);
      return;
    }
    if(newSession && (event==="SIGNED_IN" || event==="INITIAL_SESSION" || event==="TOKEN_REFRESHED")){
      setTimeout(()=>enterAdmin(newSession),0);
    }
  });

  const {data:{session:existing}} = await db.auth.getSession();
  if(existing) await enterAdmin(existing);
}

function bind(){
  $("#discordLoginBtn").onclick=loginWithDiscord;
  $("#signOutBtn").onclick=signOut;
  $("#newRuleBtn").onclick=newRule;
  $("#adminSearch").addEventListener("input",renderRuleList);
  $("#statusFilter").addEventListener("change",renderRuleList);
  $("#categoryFilter").addEventListener("change",renderRuleList);
  $("#ruleFeatured").addEventListener("change",()=>$("#featuredFields").classList.toggle("hidden",!$("#ruleFeatured").checked));
  $("#addItemBtn").onclick=()=>{editorItems.push({text:"",level:0});renderItems();};
  $("#ruleEditor").addEventListener("submit",e=>{e.preventDefault();saveRule(true)});
  $("#saveDraftBtn").onclick=()=>saveRule(false);
  $("#archiveBtn").onclick=archiveSelected;
  $("#duplicateBtn").onclick=duplicateSelected;
  $("#settingsBtn").onclick=openSettings;
  $("#closeSettings").onclick=()=>$("#settingsDialog").close();
  $("#saveSettings").onclick=saveSettings;
  $("#confirmCancel").onclick=()=>resolveConfirm(false);
  $("#confirmOk").onclick=()=>resolveConfirm(true);
  ["#ruleTitle","#ruleCategory","#ruleFeatured","#featuredTitle","#featuredIcon","#featuredDescription"].forEach(sel=>{
    const el=$(sel); if(el) el.addEventListener("input",renderPreview);
  });
}

async function loginWithDiscord(){
  setStatus($("#loginStatus"),"Opening Discord verification...");
  const redirectTo = new URL("admin.html",window.location.href).href;
  const {error}=await db.auth.signInWithOAuth({
    provider:"discord",
    options:{
      redirectTo,
      scopes:"identify email guilds.members.read"
    }
  });
  if(error) setStatus($("#loginStatus"),error.message,"error");
}

async function signOut(){
  stopVerificationRefresh();
  sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
  await db.auth.signOut();
}

async function verifyDiscordAccess(newSession,{silent=false}={}){
  const providerToken = newSession?.provider_token || sessionStorage.getItem(PROVIDER_TOKEN_KEY);
  if(newSession?.provider_token) sessionStorage.setItem(PROVIDER_TOKEN_KEY,newSession.provider_token);
  if(!providerToken){
    return {authorized:false,reason:"reverify_required",message:"Discord verification expired. Click Continue with Discord again."};
  }

  if(!silent) setStatus($("#loginStatus"),"Verifying your NHRP Discord role...");
  const {data,error}=await db.functions.invoke("verify-discord-admin",{body:{provider_token:providerToken}});
  if(error){
    const message = data?.reason==="required_role_missing"
      ? "Access denied. The NHRP Owner or Executive Discord role is required."
      : data?.reason==="not_in_nhrp_or_scope_missing"
        ? "Access denied. You must be in the NHRP Discord and approve the server-member verification scope."
        : data?.reason==="discord_token_invalid"
          ? "Discord verification expired. Sign in with Discord again."
          : (data?.detail || error.message || "Discord verification failed.");
    return {authorized:false,reason:data?.reason||"verification_error",message};
  }
  if(!data?.authorized){
    return {authorized:false,reason:data?.reason||"not_authorized",message:"Access denied. The NHRP Owner or Executive Discord role is required."};
  }
  return data;
}

async function enterAdmin(newSession){
  if(session?.access_token===newSession?.access_token && !$("#adminView").classList.contains("hidden")) return;
  session = newSession;
  const result = await verifyDiscordAccess(newSession);
  if(!result?.authorized){
    setStatus($("#loginStatus"),result?.message||"Discord verification failed.","error");
    stopVerificationRefresh();
    if(result?.reason==="required_role_missing" || result?.reason==="not_in_nhrp_or_scope_missing" || result?.reason==="discord_login_required"){
      await db.auth.signOut();
    }
    return;
  }

  discordAccess=result;
  $("#loginView").classList.add("hidden");
  $("#adminView").classList.remove("hidden");
  $("#signOutBtn").classList.remove("hidden");
  const identity=$("#discordIdentity");
  identity.innerHTML=`<b>${esc(result.role||"NHRP Admin")}</b> · ${esc(result.display_name||"Discord verified")}`;
  identity.classList.remove("hidden");
  startVerificationRefresh();
  await Promise.all([loadRules(),loadSettings()]);
}

function startVerificationRefresh(){
  stopVerificationRefresh();
  verificationTimer=setInterval(async()=>{
    if(!session) return;
    const result=await verifyDiscordAccess(session,{silent:true});
    if(!result?.authorized){
      stopVerificationRefresh();
      alert("Your Discord admin access could not be re-verified. Please sign in with Discord again.");
      await signOut();
    }else{
      discordAccess=result;
      const identity=$("#discordIdentity");
      identity.innerHTML=`<b>${esc(result.role||"NHRP Admin")}</b> · ${esc(result.display_name||"Discord verified")}`;
    }
  },10*60*1000);
}

function stopVerificationRefresh(){
  if(verificationTimer){clearInterval(verificationTimer);verificationTimer=null;}
}

function showLogin(){
  session=null; discordAccess=null; rules=[]; selectedId=null;
  stopVerificationRefresh();
  $("#adminView").classList.add("hidden");
  $("#signOutBtn").classList.add("hidden");
  $("#discordIdentity").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

async function loadRules(preserveSelection=true){
  const {data,error}=await db.from("rulebook_sections")
    .select("id,title,category,slug,sort_order,status,featured,featured_title,featured_icon,featured_description,created_at,updated_at,published_at,last_published_at,last_change_note,last_change_type,draft_payload")
    .order("sort_order",{ascending:true}).order("title",{ascending:true});
  if(error){alert("Could not load rules: "+error.message);return;}
  rules=data||[];
  rebuildFilters();
  renderRuleList();
  if(preserveSelection && selectedId && rules.some(r=>r.id===selectedId)) await selectRule(selectedId,false);
}

function rebuildFilters(){
  const cats=[...new Set(rules.map(r=>r.category).filter(Boolean))].sort();
  const filter=$("#categoryFilter");
  const current=filter.value;
  filter.innerHTML='<option value="all">All categories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if(cats.includes(current)) filter.value=current;
  $("#categorySuggestions").innerHTML=cats.map(c=>`<option value="${esc(c)}"></option>`).join("");
}

function filteredRules(){
  const q=$("#adminSearch").value.trim().toLowerCase();
  const status=$("#statusFilter").value;
  const cat=$("#categoryFilter").value;
  return rules.filter(r=>(status==="all"||r.status===status)&&(cat==="all"||r.category===cat)&&(!q||r.title.toLowerCase().includes(q)||r.category.toLowerCase().includes(q)));
}

function renderRuleList(){
  const wrap=$("#ruleList");
  const list=filteredRules();
  if(!list.length){wrap.innerHTML='<div class="history-empty">No rules match this filter.</div>';return;}
  wrap.innerHTML="";
  list.forEach((r,index)=>{
    const div=document.createElement("div");
    div.className="rule-list-item"+(r.id===selectedId?" active":"");
    const recentDays=Math.max(1,Number(settingsCache.recent_days)||14);
    const isRecent=r.last_published_at && (Date.now()-new Date(r.last_published_at).getTime()) <= recentDays*86400000;
    div.innerHTML=`<div><strong>${esc(r.title)}</strong><div class="rule-list-meta"><span>${esc(r.category)}</span><span class="status-badge status-${r.status}">${r.status}</span>${r.featured?'<span>★ Key Rule</span>':''}${isRecent?`<span class="recent-admin-badge">${esc((r.last_change_type||"updated").toUpperCase())}</span>`:''}${r.draft_payload?'<span class="status-badge status-draft">Draft changes</span>':''}</div></div><div class="order-controls"><button type="button" data-dir="-1" title="Move up">↑</button><button type="button" data-dir="1" title="Move down">↓</button></div>`;
    div.querySelector("div:first-child").onclick=()=>selectRule(r.id);
    div.querySelectorAll(".order-controls button").forEach(b=>b.onclick=e=>{e.stopPropagation();moveRule(r.id,Number(b.dataset.dir));});
    wrap.appendChild(div);
  });
}

async function selectRule(id,showLoading=true){
  selectedId=id;
  if(showLoading) setStatus($("#saveStatus"),"Loading...");
  renderRuleList();
  const rule=rules.find(r=>r.id===id); if(!rule) return;

  let source = rule;
  let items = [];
  if(rule.draft_payload){
    source = {...rule,...rule.draft_payload};
    items = (rule.draft_payload.items||[]).map(i=>({text:i.text||"",level:Number(i.level)||0}));
  }else{
    const result=await db.from("rulebook_items").select("id,text,level,sort_order").eq("section_id",id).order("sort_order",{ascending:true});
    if(result.error){setStatus($("#saveStatus"),result.error.message,"error");return;}
    items=(result.data||[]).map(i=>({id:i.id,text:i.text,level:Number(i.level)||0}));
  }
  editorItems=items.length?items:[{text:"",level:0}];
  $("#emptyEditor").classList.add("hidden");
  $("#ruleEditor").classList.remove("hidden");
  $("#editorMode").textContent=rule.draft_payload?"EDITING SAVED DRAFT":"EDIT RULE";
  $("#editorHeading").textContent=source.title||rule.title;
  $("#ruleTitle").value=source.title||rule.title;
  $("#ruleCategory").value=source.category||rule.category;
  $("#ruleSort").value=source.sort_order ?? rule.sort_order ?? 0;
  $("#ruleStatus").value=rule.status;
  $("#ruleFeatured").checked=Boolean(source.featured);
  $("#featuredFields").classList.toggle("hidden",!source.featured);
  $("#featuredTitle").value=source.featured_title||"";
  $("#featuredIcon").value=source.featured_icon||"";
  $("#featuredDescription").value=source.featured_description||"";
  $("#changeNote").value="";
  $("#archiveBtn").textContent=rule.status==="archived"?"Unarchive":"Archive";
  renderItems(); renderPreview();
  setStatus($("#saveStatus"),rule.draft_payload?"Draft loaded. Public version is unchanged until you publish.":"");
  await loadHistory(id);
}

function newRule(){
  selectedId=null;
  editorItems=[{text:"",level:0}];
  $("#emptyEditor").classList.add("hidden");
  $("#ruleEditor").classList.remove("hidden");
  $("#editorMode").textContent="NEW RULE";
  $("#editorHeading").textContent="New Rule";
  $("#ruleTitle").value="";
  $("#ruleCategory").value="General Rules";
  $("#ruleSort").value=(Math.max(0,...rules.map(r=>Number(r.sort_order)||0))+10);
  $("#ruleStatus").value="draft";
  $("#ruleFeatured").checked=false;
  $("#featuredFields").classList.add("hidden");
  $("#featuredTitle").value="";$("#featuredIcon").value="";$("#featuredDescription").value="";$("#changeNote").value="";
  $("#archiveBtn").textContent="Archive";
  $("#historyTitle").textContent="New rule";
  $("#historyList").innerHTML='<div class="history-empty">History begins after the first save.</div>';
  renderRuleList();renderItems();renderPreview();
  $("#ruleTitle").focus();
}

function renderItems(){
  const wrap=$("#itemsEditor"); wrap.innerHTML="";
  editorItems.forEach((item,index)=>{
    const row=document.createElement("div"); row.className="item-row";
    row.innerHTML=`<select aria-label="Indent level"><option value="0" ${item.level===0?'selected':''}>L0</option><option value="1" ${item.level===1?'selected':''}>L1</option><option value="2" ${item.level===2?'selected':''}>L2</option></select><textarea placeholder="Rule text...">${esc(item.text)}</textarea><div class="item-actions"><button type="button" data-act="up" title="Move up">↑</button><button type="button" data-act="down" title="Move down">↓</button><button type="button" data-act="remove" class="remove-item" title="Remove">×</button></div>`;
    row.querySelector("select").onchange=e=>{editorItems[index].level=Number(e.target.value);renderPreview();};
    row.querySelector("textarea").oninput=e=>{editorItems[index].text=e.target.value;renderPreview();};
    row.querySelectorAll("button").forEach(b=>b.onclick=()=>itemAction(index,b.dataset.act));
    wrap.appendChild(row);
  });
}

function itemAction(index,act){
  if(act==="remove"){editorItems.splice(index,1);if(!editorItems.length)editorItems.push({text:"",level:0});}
  if(act==="up"&&index>0)[editorItems[index-1],editorItems[index]]=[editorItems[index],editorItems[index-1]];
  if(act==="down"&&index<editorItems.length-1)[editorItems[index+1],editorItems[index]]=[editorItems[index],editorItems[index+1]];
  renderItems();renderPreview();
}

function renderPreview(){
  const title=$("#ruleTitle").value||"Untitled Rule";
  const lines=editorItems.filter(i=>i.text.trim());
  $("#rulePreview").innerHTML=`<div class="preview-rule"><h3>${esc(title)}</h3><ul>${lines.map(i=>`<li class="${i.level>0?'sub':''}">${esc(i.text)}</li>`).join("")||'<li>No rule lines yet.</li>'}</ul></div>`;
}

function collectPayload(publish){
  const status=publish?"published":$("#ruleStatus").value;
  return {
    title:$("#ruleTitle").value.trim(),
    category:$("#ruleCategory").value.trim(),
    slug:selectedId?(rules.find(r=>r.id===selectedId)?.slug||slugify($("#ruleTitle").value)):slugify($("#ruleTitle").value),
    sort_order:Number($("#ruleSort").value)||0,
    status,
    featured:$("#ruleFeatured").checked,
    featured_title:$("#featuredTitle").value.trim()||null,
    featured_icon:$("#featuredIcon").value.trim()||null,
    featured_description:$("#featuredDescription").value.trim()||null,
    items:editorItems.map((i,index)=>({text:i.text.trim(),level:Number(i.level)||0,sort_order:index})).filter(i=>i.text)
  };
}

async function saveRule(publish){
  const payload=collectPayload(publish);
  if(!payload.title||!payload.category){setStatus($("#saveStatus"),"Title and category are required.","error");return;}
  if(!payload.items.length){setStatus($("#saveStatus"),"Add at least one rule line.","error");return;}
  setStatus($("#saveStatus"),publish?"Publishing...":"Saving draft...");

  let result;
  if(publish){
    result=await db.rpc("save_rulebook_rule",{
      p_section_id:selectedId,
      p_payload:payload,
      p_change_note:$("#changeNote").value.trim()||null,
      p_publish:true
    });
  }else{
    result=await db.rpc("save_rulebook_draft",{
      p_section_id:selectedId,
      p_payload:payload
    });
  }
  if(result.error){setStatus($("#saveStatus"),result.error.message,"error");return;}
  selectedId=result.data;
  setStatus($("#saveStatus"),publish?"Published. The public site is updated.":"Draft saved. The public version is unchanged.","ok");
  await Promise.all([loadRules(false),loadSettings()]);
  await selectRule(selectedId,false);
}

async function archiveSelected(){
  if(!selectedId) return;
  const current=rules.find(r=>r.id===selectedId); if(!current) return;
  const unarchive=current.status==="archived";
  if(!unarchive && !(await confirmBox("Archive rule?",`Archive “${current.title}”? It will disappear from the public rulebook.`))) return;
  const targetStatus=unarchive?"draft":"archived";
  const {error}=await db.rpc("set_rulebook_status",{
    p_section_id:selectedId,
    p_status:targetStatus,
    p_change_note:unarchive?"Rule restored from archive":"Rule archived"
  });
  if(error){setStatus($("#saveStatus"),error.message,"error");return;}
  await loadRules(false);
  await selectRule(selectedId,false);
  setStatus($("#saveStatus"),unarchive?"Rule restored as draft.":"Rule archived.","ok");
}

function duplicateSelected(){
  if(!$("#ruleEditor") || $("#ruleEditor").classList.contains("hidden")) return;
  selectedId=null;
  $("#editorMode").textContent="DUPLICATE RULE";
  $("#ruleTitle").value=$("#ruleTitle").value+" (Copy)";
  $("#ruleStatus").value="draft";
  $("#ruleFeatured").checked=false;$("#featuredFields").classList.add("hidden");
  $("#ruleSort").value=(Math.max(0,...rules.map(r=>Number(r.sort_order)||0))+10);
  $("#changeNote").value="Duplicated from existing rule";
  $("#historyTitle").textContent="New duplicate";
  $("#historyList").innerHTML='<div class="history-empty">Save this duplicate to start its history.</div>';
  renderRuleList();renderPreview();
}

async function moveRule(id,dir){
  const ordered=[...rules].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const idx=ordered.findIndex(r=>r.id===id); const swap=idx+dir;
  if(idx<0||swap<0||swap>=ordered.length)return;
  const a=ordered[idx],b=ordered[swap];
  const aOrder=a.sort_order||idx*10,bOrder=b.sort_order||swap*10;
  const {error:e1}=await db.from("rulebook_sections").update({sort_order:bOrder}).eq("id",a.id);
  const {error:e2}=await db.from("rulebook_sections").update({sort_order:aOrder}).eq("id",b.id);
  if(e1||e2){alert((e1||e2).message);return;}
  await loadRules(false); renderRuleList();
}

async function loadHistory(id){
  $("#historyTitle").textContent=rules.find(r=>r.id===id)?.title||"Rule";
  const {data,error}=await db.from("rulebook_versions").select("id,action,change_note,created_at,created_by_email").eq("section_id",id).order("created_at",{ascending:false}).limit(30);
  if(error){$("#historyList").innerHTML=`<div class="history-empty">${esc(error.message)}</div>`;return;}
  if(!data?.length){$("#historyList").innerHTML='<div class="history-empty">No previous versions yet.</div>';return;}
  $("#historyList").innerHTML=data.map(v=>`<div class="history-entry"><strong>${esc(v.action||"save")}</strong><small>${new Date(v.created_at).toLocaleString()}${v.created_by_email?` · ${esc(v.created_by_email)}`:""}</small>${v.change_note?`<div>${esc(v.change_note)}</div>`:""}<button type="button" data-version="${v.id}">Restore this version</button></div>`).join("");
  $$("[data-version]").forEach(b=>b.onclick=()=>restoreVersion(b.dataset.version));
}

async function restoreVersion(versionId){
  if(!(await confirmBox("Restore previous version?","The current rule will be saved to history first, then this older version will be restored."))) return;
  const {data:id,error}=await db.rpc("rollback_rulebook_rule",{p_version_id:versionId});
  if(error){alert(error.message);return;}
  selectedId=id;
  await loadRules(false); await selectRule(id,false);
  setStatus($("#saveStatus"),"Previous version restored.","ok");
}

async function loadSettings(){
  const {data,error}=await db.from("rulebook_settings").select("key,value");
  if(error)return;
  settingsCache=Object.fromEntries((data||[]).map(s=>[s.key,s.value]));
}
function openSettings(){
  $("#settingsDiscord").value=settingsCache.discord_url||CONFIG.FALLBACK_DISCORD_URL||"";
  $("#settingsRevised").value=settingsCache.revised_date||todayLabel();
  $("#settingsRecentDays").value=Math.max(1,Math.min(90,Number(settingsCache.recent_days)||14));
  setStatus($("#settingsStatus"),"");
  $("#settingsDialog").showModal();
}
async function saveSettings(){
  setStatus($("#settingsStatus"),"Saving...");
  const rows=[
    {key:"discord_url",value:$("#settingsDiscord").value.trim()},
    {key:"revised_date",value:$("#settingsRevised").value.trim()},
    {key:"recent_days",value:Math.max(1,Math.min(90,Number($("#settingsRecentDays").value)||14))}
  ];
  const {error}=await db.from("rulebook_settings").upsert(rows,{onConflict:"key"});
  if(error){setStatus($("#settingsStatus"),error.message,"error");return;}
  await loadSettings(); renderRuleList(); setStatus($("#settingsStatus"),"Saved. Public site settings update immediately.","ok");
}

function confirmBox(title,text){
  $("#confirmTitle").textContent=title;$("#confirmText").textContent=text;$("#confirmDialog").showModal();
  return new Promise(resolve=>{confirmResolver=resolve;});
}
function resolveConfirm(value){if(confirmResolver){confirmResolver(value);confirmResolver=null;}$("#confirmDialog").close();}

init();
