import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, LogOut, UserPlus, ShieldCheck, Trash2, CheckCircle, Ban, MapPin, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from './supabaseClient';
import './styles.css';

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayIso = isoDate(new Date());

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function holidays(year) {
  const fixed = {
    [`${year}-01-01`]: 'Capodanno',
    [`${year}-01-06`]: 'Epifania',
    [`${year}-04-25`]: 'Liberazione',
    [`${year}-05-01`]: 'Festa del Lavoro',
    [`${year}-06-02`]: 'Festa della Repubblica',
    [`${year}-08-15`]: 'Ferragosto',
    [`${year}-11-01`]: 'Ognissanti',
    [`${year}-12-08`]: 'Immacolata',
    [`${year}-12-25`]: 'Natale',
    [`${year}-12-26`]: 'Santo Stefano',
  };
  const e = easterDate(year);
  fixed[isoDate(e)] = 'Pasqua';
  const pasquetta = new Date(e);
  pasquetta.setDate(e.getDate() + 1);
  fixed[isoDate(pasquetta)] = 'Pasquetta';
  return fixed;
}

function monthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  const last = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= last; day++) days.push(new Date(year, month, day));
  return days;
}

function AuthBox() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    setBusy(false);
  }

  async function register(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name || email } } });
    if (error) { setMsg(error.message); setBusy(false); return; }
    const user = data.user;
    if (user) {
      const { error: pErr } = await supabase.from('profiles').insert({ id: user.id, email, full_name: name || email, approved: false, role: 'user' });
      if (pErr && !String(pErr.message).includes('duplicate')) setMsg(pErr.message);
      else setMsg('Registrazione inviata. Attendi approvazione admin.');
    } else setMsg('Controlla la tua email per confermare la registrazione.');
    setBusy(false);
  }

  return <div className="auth-page"><div className="auth-card">
    <div className="app-icon"><CalendarDays /></div>
    <h1>Calendario Lavoro</h1>
    <p>Accesso sicuro con Supabase Auth.</p>
    <form onSubmit={mode === 'login' ? login : register}>
      {mode === 'register' && <><label>Nome visibile</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Mario Rossi" /></>}
      <label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nome@email.it" />
      <label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
      {msg && <div className="msg">{msg}</div>}
      <button disabled={busy}>{busy ? 'Attendi...' : mode === 'login' ? 'Accedi' : 'Registrati'}</button>
    </form>
    <button className="secondary" onClick={()=>{setMsg(''); setMode(mode==='login'?'register':'login')}}>{mode === 'login' ? 'Crea nuovo utente' : 'Ho già un account'}</button>
    <p className="hint">Il primo admin va impostato dal database modificando il campo <b>role</b> in <b>admin</b>.</p>
  </div></div>
}

function WaitingApproval({ profile, onLogout }) {
  return <div className="auth-page"><div className="auth-card"><ShieldCheck className="big" /><h1>Utente in attesa</h1><p>Ciao {profile?.full_name || profile?.email}. Il tuo account deve essere approvato dall’amministratore.</p><button className="secondary" onClick={onLogout}>Esci</button></div></div>
}

function AdminPanel({ profile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  async function load() { setLoading(true); const { data } = await supabase.from('profiles').select('*').order('created_at', {ascending:false}); setUsers(data||[]); setLoading(false); }
  useEffect(()=>{ if(profile?.role==='admin') load(); },[profile]);
  async function updateUser(id, patch) { await supabase.from('profiles').update(patch).eq('id', id); load(); }
  async function deleteUser(id) { if(confirm('Eliminare questo profilo e le sue giornate?')) { await supabase.from('profiles').delete().eq('id', id); load(); } }
  if(profile?.role!=='admin') return null;
  return <section className="panel"><h2>Gestione utenti</h2>{loading && <p>Caricamento...</p>}<div className="users">
    {users.map(u=><div className="user-row" key={u.id}><div><b>{u.full_name || u.email}</b><span>{u.email} · {u.role} · {u.approved ? 'abilitato' : 'in attesa/bloccato'}</span></div><div className="actions">
      <button title="Abilita" onClick={()=>updateUser(u.id,{approved:true})}><CheckCircle size={18}/></button>
      <button title="Blocca" onClick={()=>updateUser(u.id,{approved:false})}><Ban size={18}/></button>
      <button title="Rendi admin" onClick={()=>updateUser(u.id,{role:u.role==='admin'?'user':'admin'})}><ShieldCheck size={18}/></button>
      <button title="Elimina" onClick={()=>deleteUser(u.id)}><Trash2 size={18}/></button>
    </div></div>)}
  </div></section>
}

function AddressInput({ value, onPick, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [timer, setTimer] = useState(null);
  async function search(q) {
    if (!q || q.length < 4) { setSuggestions([]); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=it&q=${encodeURIComponent(q)}`);
      const data = await res.json(); setSuggestions(data || []);
    } catch { setSuggestions([]); }
  }
  function change(v) { onChange(v); clearTimeout(timer); setTimer(setTimeout(()=>search(v), 450)); }
  return <div className="address"><input value={value||''} onChange={e=>change(e.target.value)} placeholder="Indirizzo / cantiere" />{suggestions.length>0 && <div className="suggestions">{suggestions.map(s=><button key={s.place_id} onClick={()=>{onPick({address:s.display_name, lat:Number(s.lat), lng:Number(s.lon)}); setSuggestions([])}}><MapPin size={14}/>{s.display_name}</button>)}</div>}</div>
}

function CalendarApp({ session, profile, onLogout }) {
  const [view, setView] = useState(new Date());
  const [days, setDays] = useState([]);
  const [selected, setSelected] = useState(todayIso);
  const [form, setForm] = useState({address:'', lat:null, lng:null, people:1, notes:''});
  const year = view.getFullYear();
  const hol = useMemo(()=>holidays(year),[year]);
  const monthName = view.toLocaleDateString('it-IT',{month:'long', year:'numeric'});
  const byDate = useMemo(()=>Object.fromEntries(days.map(d=>[d.date,d])),[days]);
  const current = byDate[selected];

  async function loadDays() { const {data,error}= await supabase.from('work_days').select('*').order('date'); if(!error) setDays(data||[]); }
  useEffect(()=>{ loadDays(); },[]);
  useEffect(()=>{ if(current) setForm({address:current.address||'', lat:current.lat, lng:current.lng, people:current.people||1, notes:current.notes||''}); else setForm({address:'',lat:null,lng:null,people:1,notes:''}); },[selected, current?.id]);
  async function save() {
    const row = {user_id:session.user.id, date:selected, ...form, people:Number(form.people)||1};
    if(current) await supabase.from('work_days').update(row).eq('id', current.id);
    else await supabase.from('work_days').insert(row);
    await loadDays();
  }
  async function remove() { if(current && confirm('Eliminare questa giornata?')) { await supabase.from('work_days').delete().eq('id', current.id); await loadDays(); } }
  const monthTotal = days.filter(d=>d.date.startsWith(`${year}-${pad(view.getMonth()+1)}`)).length;
  const peopleTotal = days.filter(d=>d.date.startsWith(`${year}-${pad(view.getMonth()+1)}`)).reduce((s,d)=>s+(d.people||1),0);

  return <div className="app"><header><div><h1>Calendario Lavoro</h1><p>{profile.full_name || profile.email} · {profile.role}</p></div><button onClick={onLogout}><LogOut size={18}/> Esci</button></header>
    <AdminPanel profile={profile}/>
    <main className="grid"><section className="panel calendar"><div className="monthbar"><button onClick={()=>setView(new Date(year,view.getMonth()-1,1))}><ChevronLeft/></button><h2>{monthName}</h2><button onClick={()=>setView(new Date(year,view.getMonth()+1,1))}><ChevronRight/></button></div>
    <div className="weekdays">{['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d=><b key={d}>{d}</b>)}</div><div className="days">{monthDays(view).map((d,i)=>{ if(!d) return <div key={i}/>; const iso=isoDate(d); const wk=d.getDay(); const isWeekend=wk===0||wk===6; const has=!!byDate[iso]; return <button key={iso} className={`${iso===selected?'sel':''} ${isWeekend?'weekend':''} ${hol[iso]?'holiday':''} ${has?'has':''}`} onClick={()=>setSelected(iso)}><span>{d.getDate()}</span>{hol[iso]&&<small>{hol[iso]}</small>}{has&&<em>{byDate[iso].people||1}</em>}</button>})}</div></section>
    <section className="panel editor"><h2>{new Date(selected).toLocaleDateString('it-IT',{weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</h2>{hol[selected]&&<div className="badge">{hol[selected]}</div>}
      <label>Indirizzo / cantiere</label><AddressInput value={form.address} onChange={(v)=>setForm({...form,address:v,lat:null,lng:null})} onPick={(p)=>setForm({...form,...p})}/>{form.lat&&<p className="ok">Coordinate salvate: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>}
      <label>Persone</label><input type="number" min="1" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/>
      <label>Note</label><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Note della giornata" />
      <div className="row"><button onClick={save}><Save size={18}/> Salva</button>{current&&<button className="danger" onClick={remove}><Trash2 size={18}/> Elimina</button>}</div>
      <div className="summary"><b>Riepilogo mese</b><span>Giornate: {monthTotal}</span><span>Totale persone/giornate: {peopleTotal}</span></div>
    </section></main></div>
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  async function loadProfile(user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile(data);
  }
  useEffect(()=>{
    supabase.auth.getSession().then(async ({data})=>{ setSession(data.session); if(data.session) await loadProfile(data.session.user); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s)=>{ setSession(s); if(s) await loadProfile(s.user); else setProfile(null); });
    return ()=>sub.subscription.unsubscribe();
  },[]);
  async function logout(){ await supabase.auth.signOut(); setSession(null); setProfile(null); }
  if(loading) return <div className="loader">Caricamento...</div>;
  if(!session) return <AuthBox/>;
  if(!profile) return <WaitingApproval profile={{email:session.user.email}} onLogout={logout}/>;
  if(!profile.approved) return <WaitingApproval profile={profile} onLogout={logout}/>;
  return <CalendarApp session={session} profile={profile} onLogout={logout}/>;
}

createRoot(document.getElementById('root')).render(<App />);
