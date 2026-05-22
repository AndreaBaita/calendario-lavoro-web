import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Ban, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, LogOut, MapPin, Pencil, Plus, Save, Search, ShieldCheck, Trash2, Upload, UserCog, UserPlus, Users, X } from 'lucide-react'
import { supabase } from './supabaseClient'

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
const SESSION_KEY = 'calendario_lavoro_session_v1'
const today = new Date()
const pad = n => String(n).padStart(2,'0')
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const parseKey = k => { const [y,m,d]=String(k).split('-').map(Number); return new Date(y,m-1,d) }
const niceDate = k => parseKey(k).toLocaleDateString('it-IT',{weekday:'long', day:'2-digit', month:'long', year:'numeric'})
const cleanUsername = v => String(v||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'_')
const isWeekend = d => [0,6].includes(d.getDay())
const emptyForm = () => ({ address:'', people:'1', notes:'', lat:'', lng:'', verified:false })

function daysInMonth(y,m){ return new Date(y,m+1,0).getDate() }
function firstMondayIndex(y,m){ return (new Date(y,m,1).getDay()+6)%7 }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }
function easterDate(year){ const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,mm=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*mm+114)/31)-1,day=((h+l-7*mm+114)%31)+1; return new Date(year,month,day) }
function italianHolidays(year){ const e=easterDate(year); return Object.fromEntries([[`${year}-01-01`,'Capodanno'],[`${year}-01-06`,'Epifania'],[`${year}-04-25`,'Liberazione'],[`${year}-05-01`,'Festa Lavoratori'],[`${year}-06-02`,'Festa della Repubblica'],[`${year}-08-15`,'Ferragosto'],[`${year}-11-01`,'Ognissanti'],[`${year}-12-08`,'Immacolata'],[`${year}-12-25`,'Natale'],[`${year}-12-26`,'Santo Stefano'],[dateKey(addDays(e,1)),'Pasquetta']]) }
async function sha256(text){ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('') }
async function passwordHash(username,password){ return sha256(`cal-lav-v1:${cleanUsername(username)}:${password}`) }

function AuthScreen({ onLogin }){
  const [mode,setMode]=useState('login')
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(false)
  async function register(clean){
    const { count, error: countError } = await supabase.from('profiles').select('id',{count:'exact',head:true})
    if(countError) throw countError
    const first = (count || 0) === 0
    const hash = await passwordHash(clean,password)
    const { data, error } = await supabase.from('profiles').insert({ username: clean, password: hash, role: first ? 'admin' : 'user', approved: first }).select('*').single()
    if(error) throw error
    if(first){ localStorage.setItem(SESSION_KEY, JSON.stringify({ userId:data.id })); onLogin(data) }
    else { setMode('login'); setPassword(''); setMsg('Registrazione salvata. Attendi che l’admin abiliti il tuo account.') }
  }
  async function login(clean){
    const { data, error } = await supabase.from('profiles').select('*').eq('username', clean).single()
    if(error || !data) throw new Error('Utente non trovato.')
    const hash = await passwordHash(clean,password)
    if(hash !== data.password) throw new Error('Password non corretta.')
    if(!data.approved) throw new Error('Utente in attesa di approvazione admin.')
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId:data.id }))
    onLogin(data)
  }
  async function submit(e){
    e.preventDefault(); setMsg('')
    const clean = cleanUsername(username)
    if(!clean || password.length < 6){ setMsg('Inserisci username valido e password di almeno 6 caratteri.'); return }
    setLoading(true)
    try{ mode === 'register' ? await register(clean) : await login(clean) }
    catch(err){ setMsg(err.message || 'Errore.') }
    finally{ setLoading(false) }
  }
  return <div className="authPage"><div className="authCard"><div className="appIcon big"><CalendarDays size={38}/></div><h1>Calendario Lavoro</h1><p>Accesso con username/password. Dati salvati online su Supabase.</p><form onSubmit={submit} className="authForm"><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" placeholder="es. andrea"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="minimo 6 caratteri"/></label>{msg&&<div className="authMsg"><AlertCircle size={16}/>{msg}</div>}<button className="primary wide" disabled={loading}>{mode==='login'?<>Accedi</>:<><UserPlus size={18}/> Registrati</>}</button></form><button className="ghost wide" onClick={()=>{setMode(mode==='login'?'register':'login');setMsg('')}}>{mode==='login'?'Crea nuovo utente':'Ho già un utente'}</button><p className="hint">Il primo utente registrato diventa admin. Gli altri restano in attesa finché li abiliti.</p></div></div>
}

function AdminPanel({ profile, refreshProfile }){
  const [profiles,setProfiles]=useState([])
  const [msg,setMsg]=useState('')
  const [newUsername,setNewUsername]=useState(profile?.username || '')
  const [newPassword,setNewPassword]=useState('')
  const [resetUser,setResetUser]=useState('')
  const [resetPassword,setResetPassword]=useState('')
  async function load(){ const { data,error }=await supabase.from('profiles').select('*').order('created_at',{ascending:true}); if(error) setMsg(error.message); else setProfiles(data||[]) }
  useEffect(()=>{ if(profile?.role==='admin') load() },[profile?.role])
  if(profile?.role!=='admin') return null
  async function approve(id,approved){ const {error}=await supabase.from('profiles').update({approved}).eq('id',id); if(error) setMsg(error.message); else { await load(); await refreshProfile() } }
  async function removeUser(id){ if(id===profile.id) return; if(!confirm('Eliminare questo utente e tutte le sue giornate?')) return; const {error}=await supabase.from('profiles').delete().eq('id',id); if(error) setMsg(error.message); else load() }
  async function saveAdmin(){
    setMsg('')
    const clean = cleanUsername(newUsername)
    if(!clean) { setMsg('Username admin non valido.'); return }
    const update = { username: clean }
    if(newPassword){ if(newPassword.length<6){ setMsg('La nuova password deve avere almeno 6 caratteri.'); return } update.password = await passwordHash(clean,newPassword) }
    const {error}=await supabase.from('profiles').update(update).eq('id',profile.id)
    if(error) setMsg(error.message); else { setNewPassword(''); setMsg('Credenziali admin aggiornate.'); await refreshProfile(); await load() }
  }
  async function resetPasswordForUser(){
    const u = profiles.find(p=>p.id===resetUser)
    if(!u || resetPassword.length<6){ setMsg('Scegli utente e password di almeno 6 caratteri.'); return }
    const hash = await passwordHash(u.username, resetPassword)
    const {error}=await supabase.from('profiles').update({password:hash}).eq('id',u.id)
    if(error) setMsg(error.message); else { setResetPassword(''); setMsg('Password utente aggiornata.') }
  }
  return <section className="card adminCard"><div className="adminHead"><div><h2><UserCog size={20}/> Gestione utenti</h2><p className="muted">Approva, blocca, elimina utenti e cambia password.</p></div><ShieldCheck size={30}/></div>{msg&&<div className="authMsg"><AlertCircle size={16}/>{msg}</div>}<div className="userList">{profiles.map(p=><div className={`userRow ${p.approved?'active':'pending'}`} key={p.id}><div><strong>{p.username}</strong><small>{p.role==='admin'?'Amministratore':'Utente'} • {p.approved?'abilitato':'in attesa/bloccato'}</small></div><div className="userActions">{!p.approved?<button className="approveBtn" onClick={()=>approve(p.id,true)}>Abilita</button>:p.id!==profile.id&&<button className="blockBtn" onClick={()=>approve(p.id,false)}><Ban size={15}/> Blocca</button>}{p.id!==profile.id&&<button className="danger small" onClick={()=>removeUser(p.id)}><Trash2 size={15}/> Elimina</button>}</div></div>)}</div><div className="adminGrid"><div className="miniBox"><h3>Cambia admin</h3><input value={newUsername} onChange={e=>setNewUsername(e.target.value)} placeholder="Nuovo username admin"/><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Nuova password admin"/><button className="primary" onClick={saveAdmin}>Salva admin</button></div><div className="miniBox"><h3>Reset password utente</h3><select value={resetUser} onChange={e=>setResetUser(e.target.value)}><option value="">Scegli utente</option>{profiles.filter(p=>p.id!==profile.id).map(p=><option key={p.id} value={p.id}>{p.username}</option>)}</select><input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="Nuova password"/><button className="ghost" onClick={resetPasswordForUser}>Aggiorna password</button></div></div></section>
}

function DayForm({ selected, entry, onSave, onDelete }){
  const [form,setForm]=useState(emptyForm())
  const [suggestions,setSuggestions]=useState([])
  const [loading,setLoading]=useState(false)
  useEffect(()=>{ setForm(entry?{address:entry.address||'',people:String(entry.people||1),notes:entry.notes||'',lat:entry.lat||'',lng:entry.lng||'',verified:!!(entry.lat&&entry.lng)}:emptyForm()); setSuggestions([]) },[selected,entry])
  useEffect(()=>{ const q=form.address?.trim(); if(!q || q.length<4 || form.verified){ setSuggestions([]); return } const t=setTimeout(async()=>{ setLoading(true); try{ const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=it&q=${encodeURIComponent(q)}`); const data=await res.json(); setSuggestions(Array.isArray(data)?data:[]) }catch{ setSuggestions([]) } finally{ setLoading(false) } },550); return()=>clearTimeout(t) },[form.address,form.verified])
  function pick(s){ setForm(f=>({...f,address:s.display_name,lat:s.lat,lng:s.lon,verified:true})); setSuggestions([]) }
  return <section className="card formCard"><h2>{entry?<Pencil size={20}/>:<Plus size={20}/>} {entry?'Modifica giornata':'Inserisci giornata'}</h2><p className="selectedDate">{niceDate(selected)}</p><label>Cantiere / indirizzo<div className="addressBox"><input value={form.address} onChange={e=>setForm({...form,address:e.target.value,verified:false,lat:'',lng:''})} placeholder="Scrivi indirizzo o nome cantiere"/><Search size={18}/></div></label>{loading&&<small>Ricerca indirizzo...</small>}{suggestions.length>0&&<div className="suggestions">{suggestions.map(s=><button key={s.place_id} onClick={()=>pick(s)}>{s.display_name}</button>)}</div>}{form.verified&&<div className="okLine"><CheckCircle2 size={16}/> Indirizzo verificato e coordinate salvate</div>}<label>Numero persone<input type="number" min="0" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></label><label>Note<textarea rows="4" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><div className="actions"><button className="primary" onClick={()=>onSave(form)}><Save size={18}/> Salva</button>{entry&&<button className="danger" onClick={onDelete}><Trash2 size={18}/> Elimina</button>}</div></section>
}

export default function App(){
  const [profile,setProfile]=useState(null)
  const [entries,setEntries]=useState({})
  const [loading,setLoading]=useState(true)
  const [viewDate,setViewDate]=useState(new Date(today.getFullYear(),today.getMonth(),1))
  const [selected,setSelected]=useState(dateKey(today))
  const [notice,setNotice]=useState('')
  async function loadProfile(id){ const {data,error}=await supabase.from('profiles').select('*').eq('id',id).single(); if(error) throw error; setProfile(data); return data }
  async function loadEntries(userId){ const {data,error}=await supabase.from('work_days').select('*').eq('user_id',userId); if(error) throw error; const map={}; (data||[]).forEach(r=>map[r.date]=r); setEntries(map) }
  async function bootstrap(){ setLoading(true); setNotice(''); try{ const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); if(saved?.userId){ const p=await loadProfile(saved.userId); if(!p.approved){ localStorage.removeItem(SESSION_KEY); setProfile(null); setNotice('Utente non ancora approvato.'); } else await loadEntries(p.id) } }catch(e){ localStorage.removeItem(SESSION_KEY); setProfile(null); setNotice(e.message) } setLoading(false) }
  useEffect(()=>{ bootstrap() },[])
  const y=viewDate.getFullYear(), m=viewDate.getMonth(), holidays=useMemo(()=>italianHolidays(y),[y]), entry=entries[selected]
  const grid=useMemo(()=>{ const arr=[]; for(let i=0;i<firstMondayIndex(y,m);i++) arr.push(null); for(let d=1; d<=daysInMonth(y,m); d++) arr.push(new Date(y,m,d)); return arr },[y,m])
  const stats=useMemo(()=>{ const monthPrefix=`${y}-${pad(m+1)}-`; const monthEntries=Object.values(entries).filter(e=>String(e.date).startsWith(monthPrefix)); const days=monthEntries.length; const people=monthEntries.reduce((sum,e)=>sum+(Number(e.people)||0),0); return {days, people, monthEntries} },[entries,y,m])
  async function handleSave(form){ if(!profile) return; const payload={ user_id:profile.id, date:selected, address:form.address, lat:form.lat?Number(form.lat):null, lng:form.lng?Number(form.lng):null, people:Number(form.people)||0, notes:form.notes }
    const {data,error}= entry ? await supabase.from('work_days').update(payload).eq('id',entry.id).select('*').single() : await supabase.from('work_days').insert(payload).select('*').single()
    if(error){ setNotice(error.message); return } setEntries(prev=>({...prev,[selected]:data})); setNotice('Giornata salvata.') }
  async function handleDelete(){ if(!entry || !confirm('Eliminare questa giornata?')) return; const {error}=await supabase.from('work_days').delete().eq('id',entry.id); if(error) setNotice(error.message); else { const copy={...entries}; delete copy[selected]; setEntries(copy); setNotice('Giornata eliminata.') } }
  function logout(){ localStorage.removeItem(SESSION_KEY); setProfile(null); setEntries({}); setNotice('') }
  function exportJson(){ const blob=new Blob([JSON.stringify(Object.values(entries),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`calendario-lavoro-${profile.username}.json`; a.click(); URL.revokeObjectURL(a.href) }
  if(loading) return <div className="loading">Caricamento...</div>
  if(!profile) return <><AuthScreen onLogin={async p=>{setProfile(p); await loadEntries(p.id)}}/>{notice&&<div className="floatingNotice">{notice}</div>}</>
  return <div className="app"><header className="topbar"><div className="brand"><div className="appIcon"><CalendarDays size={24}/></div><div><h1>Calendario Lavoro</h1><p>{profile.username} • {profile.role==='admin'?'Admin':'Utente'}</p></div></div><button className="ghost" onClick={logout}><LogOut size={18}/> Logout</button></header>{notice&&<div className="notice"><AlertCircle size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}<main className="layout"><section className="calendarWrap card"><div className="calendarHeader"><button onClick={()=>setViewDate(new Date(y,m-1,1))}><ChevronLeft/></button><div><h2>{MONTHS[m]} {y}</h2><p>{stats.days} giornate • {stats.people} presenze</p></div><button onClick={()=>setViewDate(new Date(y,m+1,1))}><ChevronRight/></button></div><div className="weekDays">{DAYS.map(d=><span key={d}>{d}</span>)}</div><div className="calendarGrid">{grid.map((d,i)=>{ if(!d) return <div key={`e-${i}`} className="day empty"/>; const k=dateKey(d), has=!!entries[k], hol=holidays[k], weekend=isWeekend(d); return <button key={k} onClick={()=>setSelected(k)} className={`day ${selected===k?'selected':''} ${has?'hasEntry':''} ${weekend?'weekend':''} ${hol?'holiday':''}`}><strong>{d.getDate()}</strong>{has&&<span className="dot"/>}{hol&&<small>{hol}</small>}{weekend&&!hol&&<small>{d.getDay()===6?'Sabato':'Domenica'}</small>}</button> })}</div><div className="legend"><span><b className="l work"/> Lavoro</span><span><b className="l week"/> Weekend</span><span><b className="l hol"/> Festività</span></div></section><aside><DayForm selected={selected} entry={entry} onSave={handleSave} onDelete={handleDelete}/><section className="card summary"><h2><FileText size={20}/> Riepilogo mese</h2>{stats.monthEntries.length===0?<p className="muted">Nessuna giornata inserita.</p>:stats.monthEntries.sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(e=><div className="summaryRow" key={e.id}><strong>{parseKey(e.date).getDate()}</strong><div><b>{e.address || 'Senza indirizzo'}</b><small><Users size={13}/> {e.people || 0} persone {e.lat&&e.lng&&<> • <MapPin size={13}/> coordinate</>}</small></div></div>)}<button className="ghost wide" onClick={exportJson}><Download size={18}/> Esporta backup JSON</button></section></aside></main><AdminPanel profile={profile} refreshProfile={async()=>profile&&loadProfile(profile.id)}/></div>
}
