let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('installBtn').style.display='inline-block';
});
document.getElementById('installBtn').addEventListener('click', async ()=>{
  if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; }
});

// Register service worker
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js'); }

const $ = (id)=>document.getElementById(id);
const fmt = (d)=> new Date(d).toISOString().slice(0,10);

function loadProfile(){
  const p = JSON.parse(localStorage.getItem('profile')||'{}');
  if(p.startDate) $('startDate').value = p.startDate;
  if(p.endDate) $('endDate').value = p.endDate;
  if(p.startWeight) $('startWeight').value = p.startWeight;
  if(p.goalWeight) $('goalWeight').value = p.goalWeight;
}
function saveProfile(){
  const p = {
    startDate: $('startDate').value,
    endDate: $('endDate').value,
    startWeight: parseFloat($('startWeight').value),
    goalWeight: parseFloat($('goalWeight').value)
  };
  localStorage.setItem('profile', JSON.stringify(p));
  return p;
}

function genTargets(p){
  const s = new Date(p.startDate), e = new Date(p.endDate);
  const days = Math.round((e - s)/(1000*60*60*24));
  const loss = p.startWeight - p.goalWeight;
  const daily = loss / days;
  const map = {};
  for(let i=0;i<=days;i++){
    const d = new Date(s.getTime()+i*86400000);
    map[fmt(d)] = +(p.startWeight - daily*i).toFixed(2);
  }
  const pace = daily.toFixed(3);
  $('paceInfo').textContent = `Target pace: ${pace} lb/day (${(daily*7).toFixed(2)} lb/week)`;
  localStorage.setItem('targets', JSON.stringify(map));
  return map;
}

function todayISO(){ return fmt(new Date()); }

function loadLogs(){ return JSON.parse(localStorage.getItem('logs')||'[]'); }
function saveLogs(arr){ localStorage.setItem('logs', JSON.stringify(arr)); }

function renderTable(){
  const logs = loadLogs();
  const targets = JSON.parse(localStorage.getItem('targets')||'{}');
  const tbody = document.querySelector('#logTable tbody');
  tbody.innerHTML='';
  logs.sort((a,b)=> a.date.localeCompare(b.date));
  logs.forEach((r, idx)=>{
    const tr = document.createElement('tr');
    const t = targets[r.date];
    const diff = (r.weight && t) ? +(r.weight - t).toFixed(2) : '';
    tr.className = (diff!=='' ? (diff<=0 ? 'ok' : 'warn') : '');
    const fast = r.fastStart && r.fastEnd ? `${r.fastStart}–${r.fastEnd}` : '';
    tr.innerHTML = `<td>${r.date}</td><td>${r.weight??''}</td><td>${t??''}</td>
      <td>${diff}</td><td>${r.lunch??''}</td><td>${r.dinner??''}</td><td>${r.workout??''}</td>
      <td>${fast}</td><td>${r.notes??''}</td>
      <td><button class="btn outline small" data-idx="${idx}">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-idx]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const i = +e.target.getAttribute('data-idx');
      const arr = loadLogs(); arr.splice(i,1); saveLogs(arr); render();
    });
  });
}

function renderCharts(){
  const logs = loadLogs();
  const targets = JSON.parse(localStorage.getItem('targets')||'{}');
  const dates = Object.keys(targets).sort();
  const tvals = dates.map(d=>targets[d]);
  const lmap = {}; logs.forEach(r=> lmap[r.date]=r.weight);
  const lw = dates.map(d=> d in lmap ? lmap[d] : null);
  if(window.wChart) window.wChart.destroy();
  const ctx = document.getElementById('weightChart');
  window.wChart = new Chart(ctx, {
    type: 'line',
    data: { labels: dates, datasets: [
      { label:'Target', data:tvals, spanGaps:true },
      { label:'Actual', data:lw, spanGaps:true }
    ]},
    options: { responsive:true, maintainAspectRatio:false, scales:{ x:{display:false} } }
  });

  // workouts per week
  const byWeek = {};
  logs.forEach(r=>{
    if(r.workout && r.workout!=='Rest'){
      const d = new Date(r.date);
      const wk = new Date(d.getFullYear(), d.getMonth(), d.getDate()-d.getDay()); // Sunday
      const k = fmt(wk);
      byWeek[k] = (byWeek[k]||0)+1;
    }
  });
  const wkLabels = Object.keys(byWeek).sort();
  const wkVals = wkLabels.map(k=>byWeek[k]);
  if(window.woChart) window.woChart.destroy();
  const ctx2 = document.getElementById('workoutChart');
  window.woChart = new Chart(ctx2, {
    type: 'bar',
    data: { labels: wkLabels, datasets: [ { label:'Workouts/Week', data:wkVals } ] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ x:{display:false}, y:{ ticks:{ stepSize:1 } } } }
  });
}

function render(){ renderTable(); renderCharts(); }

// Save button
$('saveLog').addEventListener('click', ()=>{
  const r = {
    date: $('logDate').value || todayISO(),
    weight: $('logWeight').value ? +$('logWeight').value : null,
    lunch: $('logLunch').value,
    dinner: $('logDinner').value,
    workout: $('logWorkout').value,
    fastStart: $('fastStart').value,
    fastEnd: $('fastEnd').value,
    notes: $('logNotes').value
  };
  const arr = loadLogs().filter(x=>x.date!==r.date);
  arr.push(r); saveLogs(arr); render();
});

// CSV export
$('exportData').addEventListener('click', ()=>{
  const arr = loadLogs();
  const targets = JSON.parse(localStorage.getItem('targets')||'{}');
  const headers = ['Date','Weight','Target','Diff','Lunch','Dinner','Workout','FastStart','FastEnd','Notes'];
  const rows = arr.sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
    const t = targets[r.date]; const diff = (r.weight && t) ? (r.weight - t).toFixed(2) : '';
    return [r.date, r.weight??'', t??'', diff, r.lunch??'', r.dinner??'', r.workout??'', r.fastStart??'', r.fastEnd??'', r.notes??''].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'weight_logs.csv'; a.click();
});

// Import backup JSON
$('importData').addEventListener('change', async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const txt = await file.text(); const obj = JSON.parse(txt);
  if(obj.profile) localStorage.setItem('profile', JSON.stringify(obj.profile));
  if(obj.targets) localStorage.setItem('targets', JSON.stringify(obj.targets));
  if(obj.logs) localStorage.setItem('logs', JSON.stringify(obj.logs));
  loadProfile(); render();
});

// Notifications (permission + simple daily reminder prompt)
// Note: true scheduled notifications require Push + server; this prompts and sends a reminder while app is open.
$('remindBtn').addEventListener('click', async ()=>{
  if(!('Notification' in window)) { alert('Notifications not supported'); return; }
  const perm = await Notification.requestPermission();
  if(perm !== 'granted'){ alert('Permission not granted'); return; }
  new Notification('Reminders enabled', { body:'We will remind you while the app is open.' });
});

// Init
window.addEventListener('load', ()=>{
  loadProfile();
  const profile = saveProfile();
  const targets = genTargets(profile);
  $('logDate').value = todayISO();
  render();
});

$('recalcTargets').addEventListener('click', ()=>{ const p = saveProfile(); genTargets(p); render(); });
