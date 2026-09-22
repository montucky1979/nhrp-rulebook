const DISCORD_URL = "https://discord.gg/REPLACE_ME";

const CATEGORY_CARDS = [
  {label:"Character & RP", icon:"♟", category:"Roleplay Standards", blurb:"Create believable characters and meaningful stories."},
  {label:"Rules & Conduct", icon:"✪", category:"General Rules", blurb:"Keep the community respectful and immersive."},
  {label:"Crime & Police", icon:"▰", category:"Crime & Conflict", blurb:"Realistic scenarios, consequences, and procedures."},
  {label:"Vehicles & Traffic", icon:"▣", category:"Game Mechanics", blurb:"On the roads, in the air, and on the water."},
  {label:"Illegal Activities", icon:"⚒", category:"Factions & Conflict", blurb:"Higher risk. Higher consequence. Proper roleplay."},
  {label:"Interactions", icon:"♣", category:"Community & Reports", blurb:"People, places, reports, and player conduct."},
  {label:"General Rules", icon:"★", category:"General Rules", blurb:"The foundation of NHRP."}
];

const FEATURED = [
  {title:"Be Serious", icon:"🎭", section:"Fail RP", desc:"Keep RP realistic, mature, and story-driven at all times."},
  {title:"Respect Everyone", icon:"👥", section:"General Rules", desc:"Treat players and staff with respect. Keep the community positive."},
  {title:"No Random Deathmatch", icon:"☠", section:"Random Deathmatch (RDM)", desc:"Violence must have valid roleplay interaction and consequence."},
  {title:"Follow Police RP", icon:"🛡", section:"Police / LEO Rules", desc:"Give realistic scenarios and cooperate with law enforcement RP."},
  {title:"Stay In Character", icon:"💬", section:"Staying in Character", desc:"Keep the scene immersive and handle rule issues afterward."},
  {title:"No Meta-Gaming", icon:"⊘", section:"Metagaming", desc:"Keep IC and OOC information separate at all times."},
  {title:"Proper Vehicle RP", icon:"🚗", section:"Realistic Vehicle Operation", desc:"Drive realistically and roleplay vehicle damage properly."},
  {title:"Consequences Matter", icon:"⚠", section:"Value of Life", desc:"Your actions carry risk. Value your life, freedom, and the scene."}
];

let data;
let activeCategory = "All";
let query = "";
let sortMode = "source";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function slugify(s){return s.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function esc(s){return (s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function hi(s){
  if(!query) return esc(s);
  const safe = esc(s);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return safe.replace(new RegExp(`(${q})`,"ig"),'<mark class="match">$1</mark>');
}
function categories(){return [...new Set(data.sections.map(s=>s.category))]}
function findSection(title){return data.sections.find(s=>s.title===title)}

async function init(){
  data = window.RULES_DATA || await fetch("rules.json").then(r=>r.json());
  $("#revisedFooter").textContent = `Rules revised ${data.revised}`;
  ["#discordTop","#discordSide"].forEach(sel=>{ const el=$(sel); if(el) el.href=DISCORD_URL; });
  renderCategories();
  renderFilters();
  renderFeatured();
  renderRules();
  renderTables();
  bind();
  startArcade();
  openHashRule();
}

function renderCategories(){
  const wrap = $("#categories");
  wrap.innerHTML = "";
  CATEGORY_CARDS.forEach(card=>{
    const el=document.createElement("button");
    el.className="category-card";
    el.innerHTML=`<span class="category-icon">${card.icon}</span><strong>${esc(card.label)}</strong><small>${esc(card.blurb)}</small>`;
    el.onclick=()=>{
      activeCategory=card.category;
      syncFilters();
      renderRules();
      $("#fullRulebook").scrollIntoView({behavior:"smooth",block:"start"});
    };
    wrap.appendChild(el);
  });
}

function renderFilters(){
  const wrap=$("#filterRow");
  wrap.innerHTML="";
  ["All",...categories()].forEach(c=>{
    const b=document.createElement("button");
    b.className="filter-chip"+(c===activeCategory?" active":"");
    b.textContent=c;
    b.onclick=()=>{activeCategory=c;syncFilters();renderRules()};
    wrap.appendChild(b);
  });
}
function syncFilters(){ $$(".filter-chip").forEach(b=>b.classList.toggle("active",b.textContent===activeCategory)); }

function renderFeatured(){
  const wrap=$("#featuredRules");
  wrap.innerHTML="";
  FEATURED.forEach((item,i)=>{
    const section=findSection(item.section);
    if(!section) return;
    const id="rule-"+slugify(section.title);
    const card=document.createElement("article");
    card.className="featured-card";
    card.tabIndex=0;
    card.innerHTML=`<div class="featured-top"><span class="featured-num">${String(i+1).padStart(2,"0")}</span><span class="featured-ico">${item.icon}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.desc)}</p>`;
    const go=()=>{location.hash=id;activeCategory="All";syncFilters();query="";$("#ruleSearch").value="";renderRules();openHashRule()};
    card.onclick=go;
    card.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}};
    wrap.appendChild(card);
  });
}

function renderRules(){
  let arr=data.sections.map((s,i)=>({...s,_i:i}));
  if(activeCategory!=="All") arr=arr.filter(s=>s.category===activeCategory);
  if(query){
    const q=query.toLowerCase();
    arr=arr.filter(s=>s.title.toLowerCase().includes(q)||s.items.some(it=>it.text.toLowerCase().includes(q)));
  }
  if(sortMode==="az") arr.sort((a,b)=>a.title.localeCompare(b.title));
  $("#resultCount").textContent=`${arr.length} rule section${arr.length===1?"":"s"} shown`;
  const wrap=$("#rulesList");
  wrap.innerHTML="";
  if(!arr.length){wrap.innerHTML='<div class="empty-state"><strong>No matching rules.</strong><br>Try another keyword or clear the filters.</div>';return}
  arr.forEach(s=>{
    const id="rule-"+slugify(s.title);
    const d=document.createElement("details");
    d.className="rule-card";
    d.id=id;
    const items=s.items.map(it=>`<li class="${it.level>0?"sub":""}">${hi(it.text)}</li>`).join("");
    d.innerHTML=`<summary class="rule-summary"><span class="rule-num">${String(s._i+1).padStart(2,"0")}</span><div><div class="rule-title">${hi(s.title)}</div><div class="rule-cat">${esc(s.category)}</div></div><span class="rule-chevron">›</span></summary><div class="rule-body"><ul>${items||"<li>See the official rulebook section.</li>"}</ul><div class="rule-tools"><button class="copy-link" data-link="${id}">Copy rule link</button></div></div>`;
    wrap.appendChild(d);
  });
  $$(".copy-link").forEach(b=>b.onclick=e=>{
    e.preventDefault();
    const url=location.href.split("#")[0]+"#"+b.dataset.link;
    navigator.clipboard?.writeText(url);
    b.textContent="Copied!";
    setTimeout(()=>b.textContent="Copy rule link",1200);
  });
}

function renderTable(rows,el){
  if(!rows?.length) return;
  const [head,...body]=rows;
  el.innerHTML=`<table><thead><tr>${head.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function renderTables(){renderTable(data.progressiveTable,$("#progressiveWrap"));renderTable(data.matrixTable,$("#matrixWrap"));}

function bind(){
  $("#ruleSearch").addEventListener("input",e=>{query=e.target.value.trim();renderRules()});
  $("#sortSelect").addEventListener("change",e=>{sortMode=e.target.value;renderRules()});
  $("#clearSearch").onclick=()=>{query="";activeCategory="All";$("#ruleSearch").value="";syncFilters();renderRules()};
  document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$("#ruleSearch").focus()}});
  $("#toggleMatrix").onclick=()=>{const m=$("#matrixWrap");m.classList.toggle("hidden");$("#toggleMatrix").textContent=m.classList.contains("hidden")?"Show Matrix":"Hide Matrix"};
  addEventListener("hashchange",openHashRule);
}

function openHashRule(){
  const id=location.hash.slice(1);
  if(!id.startsWith("rule-")) return;
  setTimeout(()=>{
    const el=document.getElementById(id);
    if(el){el.open=true;el.scrollIntoView({behavior:"smooth",block:"center"});}
  },80);
}

function startArcade(){
  let t=60,score=12340;
  setInterval(()=>{
    t=t<=0?60:t-1;
    score+=10;
    $("#gameTime").textContent=String(t).padStart(2,"0");
    $("#score").textContent=String(score).padStart(6,"0");
  },1000);
}

init().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML("beforeend",'<div style="position:fixed;bottom:10px;left:10px;z-index:200;background:#401;color:#fff;padding:10px;border-radius:8px">The rulebook data could not be loaded.</div>');
});
