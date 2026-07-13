/* ============================================
   AI TOOLCOR — CORE APP.JS
   business.aitoolcor.com
   ============================================ */

// ===== Auth =====
(function(){
  if(!localStorage.getItem('bd_auth')) window.location.href='login.html';
})();

const SK = 'bd_transactions';

// ===== Storage =====
const Store = {
  cache: null,
  get(){
    if(this.cache === null){
      try { this.cache = JSON.parse(localStorage.getItem(SK) || '[]'); }
      catch(e){ this.cache = []; }
    }
    return this.cache;
  },
  save(data){
    this.cache = data;
    localStorage.setItem(SK, JSON.stringify(data));
  },
  invalidate(){ this.cache = null; }
};

function getTxns(){ return Store.get(); }
function saveTxns(d){ Store.save(d); }

// ===== Currency =====
function inr(a){
  const n = parseFloat(a) || 0;
  return '₹ ' + n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function inrShort(a){
  const n = parseFloat(a) || 0;
  if(Math.abs(n) >= 10000000) return '₹' + (n/10000000).toFixed(1) + 'Cr';
  if(Math.abs(n) >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
  if(Math.abs(n) >= 1000) return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

// ===== Date Helpers =====
function today(){ return new Date().toISOString().split('T')[0]; }

function fmtDate(d){
  if(!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', {
    day:'2-digit', month:'short', year:'numeric'
  });
}

function fmtDateFull(d){
  if(!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });
}

function isToday(d){ return d === today(); }

function isYesterday(d){
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d === y.toISOString().split('T')[0];
}

function isThisWeek(d){
  const now = new Date();
  const dt = new Date(d);
  const s = new Date(now);
  s.setDate(now.getDate() - now.getDay() + 1);
  s.setHours(0,0,0,0);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23,59,59,999);
  return dt >= s && dt <= e;
}

function isLastWeek(d){
  const now = new Date();
  const dt = new Date(d);
  const s = new Date(now);
  s.setDate(now.getDate() - now.getDay() - 6);
  s.setHours(0,0,0,0);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23,59,59,999);
  return dt >= s && dt <= e;
}

function isThisMonth(d){
  const n = new Date();
  const dt = new Date(d);
  return dt.getMonth() === n.getMonth() && dt.getFullYear() === n.getFullYear();
}

function isLastMonth(d){
  const n = new Date();
  const dt = new Date(d);
  const lm = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return dt.getMonth() === lm.getMonth() && dt.getFullYear() === lm.getFullYear();
}

function isThisYear(d){
  return new Date(d).getFullYear() === new Date().getFullYear();
}

function inRange(d, s, e){
  const dt = new Date(d);
  const st = new Date(s);
  const en = new Date(e);
  en.setHours(23,59,59,999);
  return dt >= st && dt <= en;
}

// ===== Calculations =====
function calcTotals(t){
  let income = 0, expense = 0;
  for(let i = 0; i < t.length; i++){
    const x = t[i];
    const amt = parseFloat(x.amount) || 0;
    if(x.type === 'income') income += amt;
    else if(x.type === 'expense') expense += amt;
  }
  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    profit: Math.round((income - expense) * 100) / 100
  };
}

function filterByPeriod(t, p, s, e){
  if(p === 'all') return t;
  if(p === 'today') return t.filter(x => isToday(x.date));
  if(p === 'yesterday') return t.filter(x => isYesterday(x.date));
  if(p === 'week') return t.filter(x => isThisWeek(x.date));
  if(p === 'lastweek') return t.filter(x => isLastWeek(x.date));
  if(p === 'month') return t.filter(x => isThisMonth(x.date));
  if(p === 'lastmonth') return t.filter(x => isLastMonth(x.date));
  if(p === 'year') return t.filter(x => isThisYear(x.date));
  if(p === 'custom' && s && e) return t.filter(x => inRange(x.date, s, e));
  return t;
}

// ===== Helpers =====
function uid(){
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function debounce(fn, wait){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ===== Modal =====
function openModal(id){
  const m = document.getElementById(id);
  if(m) m.classList.add('open');
}

function closeModal(id){
  const m = document.getElementById(id);
  if(m) m.classList.remove('open');
}

document.addEventListener('click', e => {
  if(e.target.classList.contains('modal-bg')) e.target.classList.remove('open');
});

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
  }
});

// ===== Toast =====
function toast(msg, type = 'success'){
  const c = document.getElementById('toastBox');
  if(!c) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const colors = { success:'var(--income)', error:'var(--expense)', warning:'var(--profit)', info:'var(--brand)' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.borderLeftColor = colors[type] || colors.success;
  t.innerHTML = `<span>${icons[type] || '✅'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ===== Confirm =====
async function confirmDel(msg){
  return new Promise(r => {
    const o = document.createElement('div');
    o.className = 'modal-bg open';
    o.innerHTML = `<div class="modal" style="max-width:400px;">
      <div class="modal-hd"><h3>⚠️ Confirm Delete</h3></div>
      <div class="modal-bd"><p style="font-size:0.9rem;color:var(--text-body);line-height:1.6;">${msg}</p></div>
      <div class="modal-ft">
        <button class="btn btn-outline" id="cfN">Cancel</button>
        <button class="btn btn-expense" id="cfY">Delete</button>
      </div>
    </div>`;
    document.body.appendChild(o);
    o.querySelector('#cfY').onclick = () => { o.remove(); r(true); };
    o.querySelector('#cfN').onclick = () => { o.remove(); r(false); };
    o.onclick = ev => { if(ev.target === o){ o.remove(); r(false); } };
  });
}

// ===== Amount Preview =====
function previewAmt(type){
  const isI = type === 'income';
  const amt = parseFloat(document.getElementById(isI ? 'iAmt' : 'eAmt').value) || 0;
  const p = document.getElementById(isI ? 'iPreview' : 'ePreview');
  const v = document.getElementById(isI ? 'iPreviewVal' : 'ePreviewVal');
  if(amt > 0){
    p.style.display = 'flex';
    v.textContent = inr(amt);
  } else {
    p.style.display = 'none';
  }
}

// ===== Header Clock =====
function updateHeaderDateTime(){
  const now = new Date();
  const d = now.toLocaleDateString('en-IN', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });
  const t = now.toLocaleTimeString('en-IN', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
  });
  const de = document.getElementById('headerDate');
  if(de) de.textContent = d;
  const te = document.getElementById('liveTime');
  if(te) te.textContent = 'LIVE ' + t;
}
updateHeaderDateTime();
setInterval(updateHeaderDateTime, 1000);

// ===== Sidebar =====
function toggleSidebar(){
  const s = document.getElementById('sidebar');
  const o = document.getElementById('overlay');
  s.classList.toggle('open');
  o.style.display = s.classList.contains('open') ? 'block' : 'none';
}

function closeSidebar(){
  document.getElementById('sidebar')?.classList.remove('open');
  const o = document.getElementById('overlay');
  if(o) o.style.display = 'none';
}

window.addEventListener('resize', debounce(() => {
  if(window.innerWidth > 900){
    document.getElementById('sidebar')?.classList.remove('open');
    const o = document.getElementById('overlay');
    if(o) o.style.display = 'none';
  }
}, 200));

// ===== Logout =====
function logout(){
  if(confirm('Sign out of your account?')){
    localStorage.removeItem('bd_auth');
    localStorage.removeItem('bd_user');
    window.location.href = 'login.html';
  }
}

// ===== Export Excel =====
function exportExcel(){
  const t = getTxns();
  if(!t.length){ toast('No data to export!', 'warning'); return; }
  const rows = t.map((x, i) => ({
    '#': i + 1,
    'Date': fmtDate(x.date),
    'Type': x.type === 'income' ? 'Income' : 'Expense',
    'Category': x.category,
    'Amount': x.amount,
    'Mode': x.mode || '-',
    'Customer/Vendor': x.from || x.vendor || '-',
    'Notes': x.notes || '-'
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, `AI-Toolcor-${today()}.xlsx`);
  toast('Excel exported!');
}

// ===== Export PDF =====
function exportPDF(){
  const t = getTxns();
  if(!t.length){ toast('No data to export!', 'warning'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(6, 182, 212);
  doc.text('AI Toolcor Business', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text('Transaction Report', 14, 28);
  doc.setFontSize(9);
  doc.text('Generated: ' + new Date().toLocaleString('en-IN'), 14, 34);
  const tot = calcTotals(t);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Income: ${inr(tot.income)}   Expense: ${inr(tot.expense)}   Profit: ${inr(tot.profit)}`, 14, 42);
  doc.autoTable({
    startY: 48,
    head: [['#','Date','Type','Category','Amount','Mode']],
    body: t.map((x, i) => [
      i + 1,
      fmtDate(x.date),
      x.type === 'income' ? 'Income' : 'Expense',
      x.category,
      inr(x.amount),
      x.mode || '-'
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] }
  });
  doc.save(`AI-Toolcor-${today()}.pdf`);
  toast('PDF exported!');
}

// ===== Backup =====
function downloadBackup(){
  const data = {
    version: '2.0',
    business: 'AI Toolcor',
    exported: new Date().toISOString(),
    transactions: getTxns()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI-Toolcor-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('bd_last_backup', today());
  toast('Backup downloaded!');
}