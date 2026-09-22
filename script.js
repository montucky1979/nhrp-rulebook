const DISCORD_URL = "https://discord.gg/REPLACE_ME";
const CATEGORY_META = {
  "General Rules": ["★","Foundation and community basics"],
  "Roleplay Standards": ["🎭","Character and scene quality"],
  "Crime & Conflict": ["⚔","Escalation, combat, hostages"],
  "Police / LEO": ["🛡","Law enforcement interactions"],
  "EMS / Fire & Media": ["✚","EMS, Fire, and streaming"],
  "Game Mechanics": ["⚙","Mechanics, meta, exploits"],
  "Factions & Conflict": ["♟","Faction and gang rules"],
  "Ownership & Purchases": ["⌂","Businesses, housing, Tebex"],
  "Community & Reports": ["☰","Discord, reports, tickets"],
  "Discipline & Reference": ["⚖","Comms, punishments, reference"]
};
let data, activeCategory="All", query="", sortMode="source";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function slugify(s){return s.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function esc(s){return (s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function hi(s){if(!query)return esc(s);const safe=esc(s);const q=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return safe.replace(new RegExp(`(${q})`,'ig'),'<mark class="match">$1</mark>')}
async function init(){
  data=window.RULES_DATA || await fetch('rules.json').then(r=>r.json());
  $('#introText').textContent='Search the full NHRP rulebook, jump by category, and share direct rule links. Source revision: '+data.revised+'.';
  $('#revisedFooter').textContent='Rules revised '+data.revised;
  ['#discordTop','#discordSide','#discordDialog'].forEach(s=>$(s).href=DISCORD_URL);
  renderCategories();renderFilters();renderRules();renderTables();bind();startArcade();openHashRule();
}
function categories(){return [...new Set(data.sections.map(s=>s.category))]}
function renderCategories(){
  const wrap=$('#categories');wrap.innerHTML='';
  categories().slice(0,7).forEach(c=>{const [icon,desc]=CATEGORY_META[c]||['•','Rule category'];const count=data.sections.filter(s=>s.category===c).length;const el=document.createElement('button');el.className='category-card';el.innerHTML=`<span class="category-icon">${icon}</span><strong>${esc(c)}</strong><small>${count} sections · ${esc(desc)}</small>`;el.onclick=()=>{activeCategory=c;syncFilters();renderRules();$('#rules').scrollIntoView({behavior:'smooth'})};wrap.appendChild(el)});
}
function renderFilters(){const wrap=$('#filterRow');wrap.innerHTML='';['All',...categories()].forEach(c=>{const b=document.createElement('button');b.className='filter-chip'+(c===activeCategory?' active':'');b.textContent=c;b.onclick=()=>{activeCategory=c;syncFilters();renderRules()};wrap.appendChild(b)})}
function syncFilters(){ $$('.filter-chip').forEach(b=>b.classList.toggle('active',b.textContent===activeCategory)) }
function renderRules(){
  let arr=data.sections.map((s,i)=>({...s,_i:i}));
  if(activeCategory!=='All') arr=arr.filter(s=>s.category===activeCategory);
  if(query){const q=query.toLowerCase();arr=arr.filter(s=>s.title.toLowerCase().includes(q)||s.items.some(i=>i.text.toLowerCase().includes(q)))}
  if(sortMode==='az')arr.sort((a,b)=>a.title.localeCompare(b.title));
  $('#resultCount').textContent=`${arr.length} rule section${arr.length===1?'':'s'} shown`;
  const wrap=$('#rulesList');wrap.innerHTML='';
  if(!arr.length){wrap.innerHTML='<div class="empty-state"><strong>No matching rules.</strong><br>Try another keyword or clear the filters.</div>';return}
  arr.forEach((s,idx)=>{
    const id='rule-'+slugify(s.title);const d=document.createElement('details');d.className='rule-card';d.id=id;
    const items=s.items.map(it=>`<li class="${it.level>0?'sub':''}">${hi(it.text)}</li>`).join('');
    d.innerHTML=`<summary class="rule-summary"><span class="rule-num">${String(s._i+1).padStart(2,'0')}</span><div><div class="rule-title">${hi(s.title)}</div><div class="rule-cat">${esc(s.category)}</div></div><span class="rule-chevron">›</span></summary><div class="rule-body"><ul>${items||'<li>See source rulebook section.</li>'}</ul><div class="rule-tools"><button class="copy-link" data-link="${id}">Copy rule link</button></div></div>`;
    wrap.appendChild(d)
  });
  $$('.copy-link').forEach(b=>b.onclick=e=>{e.preventDefault();const id=b.dataset.link;const url=location.href.split('#')[0]+'#'+id;navigator.clipboard?.writeText(url);b.textContent='Copied!';setTimeout(()=>b.textContent='Copy rule link',1200)});
}
function renderTable(rows,el){if(!rows?.length)return;const [head,...body]=rows;el.innerHTML=`<table><thead><tr>${head.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
function renderTables(){renderTable(data.progressiveTable,$('#progressiveWrap'));renderTable(data.matrixTable,$('#matrixWrap'))}
function bind(){
  $('#ruleSearch').addEventListener('input',e=>{query=e.target.value.trim();renderRules()});
  $('#sortSelect').addEventListener('change',e=>{sortMode=e.target.value;renderRules()});
  $('#clearSearch').onclick=()=>{query='';activeCategory='All';$('#ruleSearch').value='';syncFilters();renderRules()};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$('#ruleSearch').focus()}});
  $('#toggleMatrix').onclick=()=>{const m=$('#matrixWrap');m.classList.toggle('hidden');$('#toggleMatrix').textContent=m.classList.contains('hidden')?'Show Matrix':'Hide Matrix'};
  const dlg=$('#faqDialog');$('#openFaq').onclick=()=>dlg.showModal();$('#closeFaq').onclick=()=>dlg.close();
  addEventListener('hashchange',openHashRule);
}
function openHashRule(){const id=location.hash.slice(1);if(!id.startsWith('rule-'))return;setTimeout(()=>{const el=document.getElementById(id);if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'})}},100)}
function startArcade(){let t=60,score=12340;setInterval(()=>{t=t<=0?60:t-1;score+=10;$('#gameTime').textContent=String(t).padStart(2,'0');$('#score').textContent=String(score).padStart(6,'0')},1000)}
init().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;bottom:10px;left:10px;background:#401;color:white;padding:10px">Could not load rules.json. Run the site from a web server, not directly from file://.</div>')});
