import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qsnnwehlzcmqahydtrlu.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_12NtU7j97csK3MtfKKOsBw_wuB34NeZ';
const supabase = createClient(supabaseUrl, supabaseKey);

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const PARTS = { full:'Giornata intera', morning:'Mattina', afternoon:'Pomeriggio' };

function easterDate(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}
function iso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function holidays(year){
  const e=easterDate(year); const pasquetta=new Date(e); pasquetta.setDate(e.getDate()+1);
  const fixed={'01-01':'Capodanno','01-06':'Epifania','04-25':'Liberazione','05-01':'Festa del lavoro','06-02':'Festa della Repubblica','08-15':'Ferragosto','11-01':'Ognissanti','12-08':'Immacolata','12-25':'Natale','12-26':'Santo Stefano'};
  const out={}; Object.entries(fixed).forEach(([k,v])=>out[`${year}-${k}`]=v); out[iso(pasquetta)]='Pasquetta'; out[iso(e)]='Pasqua'; return out;
}
function monthDays(y,m){
  const first=new Date(y,m,1), last=new Date(y,m+1,0); const start=(first.getDay()+6)%7; const arr=[];
  for(let i=0;i<start;i++) arr.push(null); for(let d=1;d<=last.getDate();d++) arr.push(new Date(y,m,d)); return arr;
}
function weight(item){ return item.day_part === 'morning' || item.day_part === 'afternoon' ? 0.5 : 1; }
function newForm(dateValue){ return {date:dateValue,entry_type:'work',day_part:'full',address:'',lat:null,lng:null,people:1,rest_reason:'',notes:''}; }

function App(){
  const [session,setSession]=useState(null); const [profile,setProfile]=useState(null); const [authMode,setAuthMode]=useState('login');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [username,setUsername]=useState(''); const [message,setMessage]=useState('');
  const [date,setDate]=useState(new Date()); const [workDays,setWorkDays]=useState([]); const [users,setUsers]=useState([]);
  const [editing,setEditing]=useState(null); const [selectedDate,setSelectedDate]=useState(null); const [form,setForm]=useState(newForm(iso(new Date())));
  const [suggestions,setSuggestions]=useState([]); const [loading,setLoading]=useState(false);

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>subscription.unsubscribe(); },[]);
  useEffect(()=>{ if(session?.user) loadProfile(); else setProfile(null); },[session]);
  useEffect(()=>{ if(profile?.approved) loadWorkDays(); if(profile?.role==='admin') loadUsers(); },[profile]);

  async function loadProfile(){ const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single(); if(error) setMessage(error.message); else setProfile(data); }
  async function loadUsers(){ const {data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}); setUsers(data||[]); }
  async function loadWorkDays(){ const {data,error}=await supabase.from('work_days').select('*').order('date',{ascending:true}).order('day_part',{ascending:true}).order('created_at',{ascending:true}); if(error) setMessage(error.message); else setWorkDays(data||[]); }

  async function signIn(e){ e.preventDefault(); setMessage(''); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) setMessage(error.message); }
  async function signUp(e){ e.preventDefault(); setMessage(''); const {error}=await supabase.auth.signUp({email,password,options:{data:{username:username||email.split('@')[0]}}}); if(error) setMessage(error.message); else setMessage('Registrazione inviata. Il primo utente diventa admin; gli altri attendono approvazione.'); }
  async function logout(){ await supabase.auth.signOut(); setProfile(null); setWorkDays([]); }

  const currentMonth = date.getMonth(), currentYear=date.getFullYear(); const h=useMemo(()=>holidays(currentYear),[currentYear]);
  const byDate=useMemo(()=>workDays.reduce((acc,w)=>{ (acc[w.date] ||= []).push(w); return acc; },{}),[workDays]);
  const selectedEntries=selectedDate ? (byDate[selectedDate] || []) : [];
  const monthly=useMemo(()=>workDays.filter(w=>{const d=new Date(w.date+'T00:00:00'); return d.getFullYear()===currentYear && d.getMonth()===currentMonth;}),[workDays,currentYear,currentMonth]);
  const totals=useMemo(()=>{
    const sites={}; let people=0, workUnits=0, restUnits=0; const restReasons={};
    monthly.forEach(w=>{
      const units=weight(w);
      if((w.entry_type || 'work') === 'rest'){
        restUnits += units;
        const r=w.rest_reason || 'Riposo';
        restReasons[r]=(restReasons[r]||0)+units;
      } else {
        workUnits += units;
        people += Number(w.people||0) * units;
        const k=w.address||'Indirizzo non indicato';
        sites[k]=(sites[k]||0)+units;
      }
    });
    return {workEntries:monthly.filter(w=>(w.entry_type||'work')==='work').length, workUnits, restUnits, people, sites, restReasons};
  },[monthly]);

  function prevMonth(){ setDate(new Date(currentYear,currentMonth-1,1)); } function nextMonth(){ setDate(new Date(currentYear,currentMonth+1,1)); }
  function openDay(d){ const key=iso(d); setSelectedDate(key); setEditing(null); setSuggestions([]); }
  function startNew(dateValue=selectedDate || iso(new Date()), type='work'){
    setEditing({new:true});
    setForm({...newForm(dateValue), entry_type:type});
    setSuggestions([]);
  }
  function editEntry(entry){
    setEditing(entry);
    setForm({date:entry.date,entry_type:entry.entry_type||'work',day_part:entry.day_part||'full',address:entry.address||'',lat:entry.lat,lng:entry.lng,people:entry.people||1,rest_reason:entry.rest_reason||'',notes:entry.notes||''});
    setSuggestions([]);
  }
  async function saveDay(e){
    e.preventDefault(); setMessage(''); setLoading(true);
    const userId=session?.user?.id || profile?.id;
    if(!userId){ setLoading(false); setMessage('Utente non riconosciuto. Fai logout e accedi di nuovo.'); return; }
    const payload={...form,user_id:userId,people:Number(form.people||1)};
    if(payload.entry_type==='rest') { payload.address=null; payload.lat=null; payload.lng=null; payload.people=0; }
    let res;
    if(editing?.id) res=await supabase.from('work_days').update(payload).eq('id',editing.id).select().single();
    else res=await supabase.from('work_days').insert(payload).select().single();
    setLoading(false);
    if(res.error) setMessage(res.error.message);
    else { setEditing(null); setSelectedDate(res.data.date); await loadWorkDays(); }
  }
  async function deleteEntry(entry){ if(!entry) return; if(!confirm('Eliminare questa voce?')) return; const {error}=await supabase.from('work_days').delete().eq('id',entry.id); if(error) setMessage(error.message); await loadWorkDays(); }
  async function queryAddress(q){ setForm(f=>({...f,address:q})); if(q.length<4){setSuggestions([]);return;} const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=it&q=${encodeURIComponent(q)}`); const data=await r.json(); setSuggestions(data); }
  function pickAddress(s){ setForm(f=>({...f,address:s.display_name,lat:Number(s.lat),lng:Number(s.lon)})); setSuggestions([]); }
  async function setApproval(u,approved){ await supabase.from('profiles').update({approved}).eq('id',u.id); loadUsers(); }
  async function setRole(u,role){ await supabase.from('profiles').update({role}).eq('id',u.id); loadUsers(); }
  async function removeUser(u){ if(confirm('Eliminare profilo utente?')){ await supabase.from('profiles').delete().eq('id',u.id); loadUsers(); } }

  function exportPdf(){
    const doc=new jsPDF(); let y=15; doc.setFontSize(18); doc.text(`Resoconto mensile - ${MONTHS[currentMonth]} ${currentYear}`,14,y); y+=10;
    doc.setFontSize(11); doc.text(`Utente: ${profile?.username || profile?.email || ''}`,14,y); y+=8; doc.text(`Giornate lavorate equivalenti: ${totals.workUnits}`,14,y); y+=7; doc.text(`Giornate di riposo equivalenti: ${totals.restUnits}`,14,y); y+=7; doc.text(`Totale persone/giornate: ${totals.people}`,14,y); y+=10;
    doc.setFontSize(14); doc.text('Cantieri / indirizzi',14,y); y+=7; doc.setFontSize(10);
    Object.entries(totals.sites).forEach(([site,n])=>{ if(y>280){doc.addPage(); y=15;} doc.text(`- ${site}: ${n} giornate`,14,y); y+=6; });
    if(Object.keys(totals.restReasons).length){ y+=4; doc.setFontSize(14); doc.text('Riposi',14,y); y+=7; doc.setFontSize(10); Object.entries(totals.restReasons).forEach(([reason,n])=>{ if(y>280){doc.addPage(); y=15;} doc.text(`- ${reason}: ${n} giornate`,14,y); y+=6; }); }
    y+=6; doc.setFontSize(14); doc.text('Dettaglio giornate',14,y); y+=8; doc.setFontSize(10);
    monthly.forEach(w=>{ if(y>280){doc.addPage(); y=15;} const type=(w.entry_type||'work')==='rest'?'RIPOSO':'LAVORO'; const descr=(w.entry_type||'work')==='rest'?(w.rest_reason||'Riposo'):(w.address||''); doc.text(`${w.date} | ${type} | ${PARTS[w.day_part||'full']} | ${descr}`,14,y); y+=6; if((w.entry_type||'work')==='work') { doc.text(`Persone: ${w.people || 1}`,18,y); y+=6; } if(w.notes){doc.text(`Note: ${w.notes}`,18,y); y+=6;} });
    doc.save(`resoconto-${currentYear}-${String(currentMonth+1).padStart(2,'0')}.pdf`);
  }

  if(!session) return <Auth authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} username={username} setUsername={setUsername} signIn={signIn} signUp={signUp} message={message}/>;
  if(!profile) return <div className="center"><div className="card">Caricamento profilo...</div></div>;
  if(!profile.approved) return <div className="center"><div className="card"><h1>Utente in attesa</h1><p>Il tuo account è registrato ma deve essere approvato dall'amministratore.</p><button onClick={logout}>Logout</button></div></div>;

  return <div className="app">
    <header><div><h1>Calendario Lavoro</h1><p>{profile.username} · {profile.role}</p></div><button onClick={logout}>Logout</button></header>
    {message && <div className="msg">{message}</div>}
    <section className="toolbar"><button onClick={prevMonth}>←</button><h2>{MONTHS[currentMonth]} {currentYear}</h2><button onClick={nextMonth}>→</button><button onClick={exportPdf}>Esporta PDF mensile</button></section>
    <main className="grid2">
      <section className="calendar"><div className="week">{DAYS.map(d=><b key={d}>{d}</b>)}</div><div className="days">{monthDays(currentYear,currentMonth).map((d,i)=>{
        if(!d) return <div key={i} className="empty"/>; const key=iso(d); const dow=d.getDay(); const entries=byDate[key] || []; const hasRest=entries.some(w=>(w.entry_type||'work')==='rest'); const hasWork=entries.some(w=>(w.entry_type||'work')==='work'); const label=entries.map(w=>(w.entry_type||'work')==='rest' ? `Riposo: ${w.rest_reason||''}` : (w.address||'Lavoro')).join(' • ');
        return <button key={key} onClick={()=>openDay(d)} className={`day ${dow===6?'sabato':''} ${dow===0?'domenica':''} ${h[key]?'holiday':''} ${hasWork?'worked':''} ${hasRest?'rested':''} ${selectedDate===key?'selected':''}`}><span>{d.getDate()}</span>{h[key]&&<small>{h[key]}</small>}{entries.length>0&&<em>{label.slice(0,42)}</em>}{entries.length>1&&<strong className="badge">{entries.length} voci</strong>}</button>})}</div></section>
      <section className="panel">
        {!selectedDate && !editing && <div className="day-help"><h2>Seleziona un giorno</h2><p>Tocca una casella del calendario per aggiungere lavoro, riposo o vedere dove hai lavorato.</p></div>}
        {selectedDate && !editing && <div className="day-summary"><h2>Giornata del {selectedDate}</h2>{selectedEntries.length===0 && <p>Nessuna voce inserita per questa data.</p>}{selectedEntries.map(entry=><div className={`entry-card ${(entry.entry_type||'work')==='rest'?'rest-entry':''}`} key={entry.id}><div className="entry-head"><b>{(entry.entry_type||'work')==='rest'?'Riposo':'Lavoro'}</b><span>{PARTS[entry.day_part||'full']}</span></div>{(entry.entry_type||'work')==='rest' ? <div className="summary-line"><span>Motivo</span><b>{entry.rest_reason || 'Non indicato'}</b></div> : <><div className="summary-line"><span>Indirizzo / cantiere</span><b>{entry.address || 'Non indicato'}</b></div><div className="summary-line"><span>Persone</span><b>{entry.people || 1}</b></div>{entry.lat && entry.lng && <a className="map-link" href={`https://www.google.com/maps?q=${entry.lat},${entry.lng}`} target="_blank" rel="noreferrer">Apri posizione su Google Maps</a>}</>}{entry.notes && <div className="summary-line"><span>Note</span><b>{entry.notes}</b></div>}<div className="actions"><button onClick={()=>editEntry(entry)}>Modifica</button><button className="danger" onClick={()=>deleteEntry(entry)}>Elimina</button></div></div>)}<div className="actions add-actions"><button onClick={()=>startNew(selectedDate,'work')}>Aggiungi lavoro</button><button className="secondary" onClick={()=>startNew(selectedDate,'rest')}>Segna riposo</button></div></div>}
        {editing && <><h2>{editing?.id?'Modifica voce':'Nuova voce'}</h2><form onSubmit={saveDay} className="form"><label>Data<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Tipo<select value={form.entry_type} onChange={e=>setForm({...form,entry_type:e.target.value})}><option value="work">Lavoro</option><option value="rest">Riposo</option></select></label><label>Durata<select value={form.day_part} onChange={e=>setForm({...form,day_part:e.target.value})}><option value="full">Giornata intera</option><option value="morning">Mezza giornata - mattina</option><option value="afternoon">Mezza giornata - pomeriggio</option></select></label>{form.entry_type==='rest'?<label>Motivo del riposo<input value={form.rest_reason} onChange={e=>setForm({...form,rest_reason:e.target.value})} placeholder="Es. ferie, malattia, pioggia, permesso" required/></label>:<><label>Indirizzo / cantiere<input value={form.address} onChange={e=>queryAddress(e.target.value)} placeholder="Scrivi indirizzo o cantiere"/></label>{suggestions.length>0&&<div className="suggestions">{suggestions.map(s=><button type="button" key={s.place_id} onClick={()=>pickAddress(s)}>{s.display_name}</button>)}</div>}<label>Persone<input type="number" min="1" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></label></>}<label>Note<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button disabled={loading}>{loading?'Salvataggio...':'Salva'}</button><button type="button" className="secondary" onClick={()=>{setEditing(null); setSuggestions([]);}}>Annulla</button></form></>}
      </section>
    </main>
    <section className="report"><h2>Resoconto mensile</h2><div className="cards"><div><b>{totals.workUnits}</b><span>giornate lavoro</span></div><div><b>{totals.restUnits}</b><span>giornate riposo</span></div><div><b>{totals.people}</b><span>persone/giornate</span></div></div><ul>{Object.entries(totals.sites).map(([s,n])=><li key={s}>{s} <b>{n}</b></li>)}{Object.entries(totals.restReasons).map(([s,n])=><li key={`r-${s}`}>Riposo: {s} <b>{n}</b></li>)}</ul></section>
    {profile.role==='admin'&&<Admin users={users} setApproval={setApproval} setRole={setRole} removeUser={removeUser}/>} 
  </div>
}
function Auth(p){ return <div className="center"><form className="card" onSubmit={p.authMode==='login'?p.signIn:p.signUp}><div className="logo">📅</div><h1>Calendario Lavoro</h1><p>Accesso sicuro con Supabase Auth e dati protetti con RLS.</p>{p.authMode==='register'&&<label>Nome visibile<input value={p.username} onChange={e=>p.setUsername(e.target.value)} required/></label>}<label>Email<input type="email" value={p.email} onChange={e=>p.setEmail(e.target.value)} required/></label><label>Password<input type="password" value={p.password} onChange={e=>p.setPassword(e.target.value)} required minLength="6"/></label>{p.message&&<div className="msg">{p.message}</div>}<button>{p.authMode==='login'?'Accedi':'Registrati'}</button><button type="button" className="secondary" onClick={()=>p.setAuthMode(p.authMode==='login'?'register':'login')}>{p.authMode==='login'?'Crea nuovo utente':'Ho già un utente'}</button></form></div> }
function Admin({users,setApproval,setRole,removeUser}){ return <section className="admin"><h2>Gestione utenti</h2><div className="table">{users.map(u=><div className="row" key={u.id}><span><b>{u.username}</b><small>{u.email}</small></span><span>{u.role}</span><span>{u.approved?'Abilitato':'In attesa/bloccato'}</span><button onClick={()=>setApproval(u,!u.approved)}>{u.approved?'Blocca':'Abilita'}</button><button onClick={()=>setRole(u,u.role==='admin'?'user':'admin')}>{u.role==='admin'?'Rendi user':'Rendi admin'}</button><button className="danger" onClick={()=>removeUser(u)}>Elimina</button></div>)}</div></section> }
createRoot(document.getElementById('root')).render(<App/>);
