import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Trash2, Save, Pencil, MapPin, Users, FileText, Download, Upload, X, PartyPopper, Search, CheckCircle2, AlertCircle, LogOut, Lock, UserPlus, ShieldCheck, UserCog, Ban, KeyRound } from 'lucide-react'

const USERS_KEY = 'calendario_lavoro_users_v1'
const SESSION_KEY = 'calendario_lavoro_session_v1'
const LEGACY_STORAGE_KEY = 'calendario_lavoro_web_v2'
const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
const today = new Date()

function pad(n){ return String(n).padStart(2,'0') }
function dateKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function parseKey(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d) }
function niceDate(k){ const d=parseKey(k); return d.toLocaleDateString('it-IT',{weekday:'long', day:'2-digit', month:'long', year:'numeric'}) }
function safeUserName(name){ return name.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'_') }
function entriesKey(username){ return `calendario_lavoro_entries_${username}` }
function loadJson(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) } catch { return fallback } }
function saveJson(key, data){ localStorage.setItem(key, JSON.stringify(data)) }
function loadEntries(username){ return loadJson(entriesKey(username), {}) }
function saveEntries(username, data){ saveJson(entriesKey(username), data) }
function daysInMonth(year, month){ return new Date(year, month+1, 0).getDate() }
function firstMondayIndex(year, month){ const js = new Date(year, month, 1).getDay(); return (js + 6) % 7 }
function isWeekend(date){ const d = date.getDay(); return d === 0 || d === 6 }

function easterDate(year){
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}
function addDays(date, amount){ const d = new Date(date); d.setDate(d.getDate() + amount); return d }
function italianHolidays(year){
  const easter = easterDate(year)
  const fixed = [
    [`${year}-01-01`, 'Capodanno'], [`${year}-01-06`, 'Epifania'], [`${year}-04-25`, 'Liberazione'],
    [`${year}-05-01`, 'Festa Lavoratori'], [`${year}-06-02`, 'Repubblica'], [`${year}-08-15`, 'Ferragosto'],
    [`${year}-11-01`, 'Ognissanti'], [`${year}-12-08`, 'Immacolata'], [`${year}-12-25`, 'Natale'], [`${year}-12-26`, 'S. Stefano'],
  ]
  fixed.push([dateKey(addDays(easter, 1)), 'Pasquetta'])
  return Object.fromEntries(fixed)
}
function normalizeEntry(e){ return { site:e?.site||'', people:e?.people||'', notes:e?.notes||'', addressStatus:e?.addressStatus||'', lat:e?.lat||'', lon:e?.lon||'' } }

function getUsers(){
  const users = loadJson(USERS_KEY, {})
  const names = Object.keys(users)
  if(names.length === 0){
    users.admin = { password:'admin123', role:'admin', status:'active', createdAt:new Date().toISOString() }
    saveJson(USERS_KEY, users)
    return users
  }
  let hasAdmin = false
  for(const name of names){
    users[name] = { password: users[name]?.password || '', role: users[name]?.role || 'user', status: users[name]?.status || 'active', createdAt: users[name]?.createdAt || new Date().toISOString() }
    if(users[name].role === 'admin') hasAdmin = true
  }
  if(!hasAdmin){ users[names[0]].role = 'admin'; users[names[0]].status = 'active' }
  saveJson(USERS_KEY, users)
  return users
}
function saveUsers(users){ saveJson(USERS_KEY, users) }
function isAdminUser(username){ const users=getUsers(); return users[username]?.role === 'admin' }

function AuthScreen({ onLogin }){
  const [mode,setMode]=useState('login')
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')

  function submit(e){
    e.preventDefault()
    const clean = safeUserName(username)
    if(!clean || password.length < 3){ setMessage('Inserisci username e password di almeno 3 caratteri.'); return }
    const users = getUsers()
    if(mode === 'register'){
      if(users[clean]){ setMessage('Utente già esistente. Usa Accedi.'); return }
      users[clean] = { password, role:'user', status:'pending', createdAt:new Date().toISOString() }
      saveUsers(users)
      setMode('login')
      setUsername(clean)
      setPassword('')
      setMessage('Registrazione inviata. Ora deve essere approvata dall’amministratore.')
      return
    }
    if(!users[clean] || users[clean].password !== password){ setMessage('Username o password non corretti.'); return }
    if(users[clean].status !== 'active') { setMessage('Utente non ancora abilitato. Attendi l’approvazione dell’amministratore.'); return }
    saveJson(SESSION_KEY, clean)
    onLogin(clean)
  }

  return <div className="authPage">
    <div className="authCard">
      <div className="appIcon big"><CalendarDays size={38}/></div>
      <h1>Calendario Lavoro</h1>
      <p>Accedi al tuo calendario personale. I nuovi utenti devono essere abilitati dall’amministratore.</p>
      <form onSubmit={submit} className="authForm">
        <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="es. andrea" autoCapitalize="none" /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" /></label>
        {message && <div className="authMsg"><AlertCircle size={16}/> {message}</div>}
        <button className="primary wide" type="submit">{mode==='login' ? <><Lock size={18}/> Accedi</> : <><UserPlus size={18}/> Crea utente</>}</button>
      </form>
      <button className="ghost wide" onClick={()=>{setMode(mode==='login'?'register':'login'); setMessage('')}}>
        {mode==='login' ? 'Crea nuovo utente' : 'Ho già un utente'}
      </button>
      <p className="hint">Primo accesso admin predefinito: username <strong>admin</strong>, password <strong>admin123</strong>. Poi crea/abilita gli utenti dal pannello admin.</p>
    </div>
  </div>
}


function AdminPanel({ currentUser, onUserChanged }){
  const [users,setUsers]=useState(()=>getUsers())
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [newUsername,setNewUsername]=useState(currentUser)
  const [currentPassword,setCurrentPassword]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [settingsMsg,setSettingsMsg]=useState('')
  const list = Object.entries(users).sort(([a,ua],[b,ub])=>{
    const order = { pending:0, active:1, blocked:2 }
    return (order[ua.status]??9)-(order[ub.status]??9) || a.localeCompare(b)
  })
  function updateUser(name, patch){
    const next = { ...users, [name]: { ...users[name], ...patch } }
    setUsers(next); saveUsers(next)
  }
  function removeUser(name){
    if(name === currentUser) return alert('Non puoi eliminare l’utente con cui sei collegato.')
    if(!confirm(`Eliminare l’utente ${name}? I suoi dati calendario restano nel browser, ma l’accesso viene rimosso.`)) return
    const next = { ...users }; delete next[name]
    setUsers(next); saveUsers(next)
  }

  function changeAdminCredentials(e){
    e.preventDefault()
    const cleanName = safeUserName(newUsername)
    if(!cleanName || cleanName.length < 3){ setSettingsMsg('Il nuovo username deve avere almeno 3 caratteri.'); return }
    if(!users[currentUser] || users[currentUser].password !== currentPassword){ setSettingsMsg('Password attuale non corretta.'); return }
    if(newPassword.length < 4){ setSettingsMsg('La nuova password deve avere almeno 4 caratteri.'); return }
    if(newPassword !== confirmPassword){ setSettingsMsg('Le nuove password non coincidono.'); return }
    if(cleanName !== currentUser && users[cleanName]){ setSettingsMsg('Questo username esiste già. Scegline un altro.'); return }

    const next = { ...users }
    const oldData = next[currentUser]
    delete next[currentUser]
    next[cleanName] = { ...oldData, password: newPassword, role:'admin', status:'active', updatedAt:new Date().toISOString() }
    saveUsers(next)
    setUsers(next)

    if(cleanName !== currentUser){
      const oldEntriesKey = entriesKey(currentUser)
      const newEntriesKey = entriesKey(cleanName)
      const oldEntries = localStorage.getItem(oldEntriesKey)
      if(oldEntries && !localStorage.getItem(newEntriesKey)) localStorage.setItem(newEntriesKey, oldEntries)
      localStorage.removeItem(SESSION_KEY)
      saveJson(SESSION_KEY, cleanName)
      onUserChanged(cleanName)
    }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    setSettingsMsg('Credenziali admin aggiornate correttamente.')
  }
  const pending = list.filter(([,u])=>u.status==='pending').length
  return <section className="card adminCard">
    <div className="adminHead"><div><h2><UserCog size={20}/> Gestione utenti</h2><p className="muted">Nuovi utenti in attesa: <strong>{pending}</strong></p></div><ShieldCheck size={28}/></div>
    <button className="smallBtn" onClick={()=>setSettingsOpen(!settingsOpen)}><KeyRound size={16}/> Cambia username/password admin</button>
    {settingsOpen && <form className="adminSettings" onSubmit={changeAdminCredentials}>
      <label>Nuovo username admin<input value={newUsername} onChange={e=>setNewUsername(e.target.value)} autoCapitalize="none" /></label>
      <label>Password attuale<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} /></label>
      <label>Nuova password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label>
      <label>Ripeti nuova password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>
      {settingsMsg && <div className="authMsg"><AlertCircle size={16}/> {settingsMsg}</div>}
      <button className="primary" type="submit"><Save size={17}/> Salva nuove credenziali</button>
    </form>}
    <div className="userList">
      {list.map(([name,u])=><div key={name} className={`userRow ${u.status}`}>
        <div><strong>{name}</strong><small>{u.role === 'admin' ? 'Amministratore' : 'Utente'} • {u.status === 'active' ? 'abilitato' : u.status === 'pending' ? 'in attesa' : 'bloccato'}</small></div>
        <div className="userActions">
          {u.status !== 'active' && <button className="approveBtn" onClick={()=>updateUser(name,{status:'active'})}>Abilita</button>}
          {u.status === 'active' && name !== currentUser && <button className="blockBtn" onClick={()=>updateUser(name,{status:'blocked'})}><Ban size={15}/> Blocca</button>}
          {u.role !== 'admin' && <button className="ghost mini" onClick={()=>removeUser(name)}>Elimina</button>}
        </div>
      </div>)}
    </div>
  </section>
}

function readSession(){
  const raw = localStorage.getItem(SESSION_KEY)
  if(!raw) return ''
  try { return JSON.parse(raw) || '' } catch { return raw || '' }
}

function emptyForm(){
  return {site:'', people:'', notes:'', addressStatus:'', lat:'', lon:''}
}

function App(){
  const [user,setUser]=useState(()=>readSession())
  const [viewDate,setViewDate]=useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [entries,setEntries]=useState(()=> user ? loadEntries(user) : {})
  const [selected,setSelected]=useState(dateKey(today))
  const [form,setForm]=useState(()=>emptyForm())
  const [usersVersion,setUsersVersion]=useState(0)
  const [editing,setEditing]=useState(false)
  const [suggestions,setSuggestions]=useState([])
  const [addressLoading,setAddressLoading]=useState(false)
  const [addressMessage,setAddressMessage]=useState('')

  const users = useMemo(()=>getUsers(), [usersVersion])
  const year=viewDate.getFullYear(), month=viewDate.getMonth()
  const holidays = useMemo(()=>italianHolidays(year),[year])
  const selectedHoliday = holidays[selected]
  const selectedDate = parseKey(selected)
  const selectedWeekend = isWeekend(selectedDate)
  const selectedEntry = entries[selected]

  useEffect(()=>{
    if(user) setEntries(loadEntries(user))
    else setEntries({})
  },[user])

  useEffect(()=>{
    if(!editing) return
    const q = form.site.trim(); setAddressMessage('')
    if(q.length < 4){ setSuggestions([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async()=>{
      try{
        setAddressLoading(true)
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=it&q=${encodeURIComponent(q)}`
        const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'it' } })
        if(!res.ok) throw new Error('search failed')
        const data = await res.json(); setSuggestions(data)
        if(data.length === 0) setAddressMessage('Nessun indirizzo trovato. Prova con via, città e provincia.')
      } catch(err){ if(err.name !== 'AbortError') setAddressMessage('Ricerca indirizzo non disponibile. Controlla la connessione.') }
      finally { setAddressLoading(false) }
    }, 550)
    return ()=>{ clearTimeout(timer); controller.abort() }
  },[form.site, editing])

  function handleLogin(username){
    saveJson(SESSION_KEY, username)
    setUser(username)
    setEntries(loadEntries(username))
    setSelected(dateKey(today))
    setForm(emptyForm())
    setEditing(false)
    setSuggestions([])
    setAddressMessage('')
    setUsersVersion(v=>v+1)
  }
  function handleLogout(){
    localStorage.removeItem(SESSION_KEY)
    setUser('')
    setEntries({})
    setSelected(dateKey(today))
    setForm(emptyForm())
    setEditing(false)
    setSuggestions([])
    setAddressMessage('')
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setUsersVersion(v=>v+1)
  }

  if(!user || !users[user] || users[user].status !== 'active') return <AuthScreen onLogin={handleLogin}/>
  const isAdmin = users[user]?.role === 'admin'

  const calendarDays = useMemo(()=>{
    const blanks = Array(firstMondayIndex(year,month)).fill(null)
    const nums = Array.from({length:daysInMonth(year,month)},(_,i)=>new Date(year,month,i+1))
    return [...blanks,...nums]
  },[year,month])

  const monthEntries = Object.entries(entries)
    .filter(([k])=>{ const d=parseKey(k); return d.getFullYear()===year && d.getMonth()===month })
    .sort(([a],[b])=>a.localeCompare(b))
  const totalPeople = monthEntries.reduce((sum,[,e])=>sum + (Number(e.people)||0),0)
  const workDays = monthEntries.length

  function changeMonth(delta){ setViewDate(new Date(year, month + delta, 1)) }
  function goToday(){ const k=dateKey(today); setViewDate(new Date(today.getFullYear(),today.getMonth(),1)); openDay(k) }
  function openDay(k){
    setSelected(k)
    const e = entries[k]
    if(e){ setForm(normalizeEntry(e)); setEditing(false) }
    else { setForm({site:'', people:'', notes:'', addressStatus:'', lat:'', lon:''}); setEditing(true) }
    setSuggestions([]); setAddressMessage('')
  }
  function pickSuggestion(place){
    setForm({...form, site: place.display_name, addressStatus: 'verified', lat: place.lat, lon: place.lon})
    setSuggestions([]); setAddressMessage('Indirizzo riconosciuto e salvato con coordinate.')
  }
  function manualAddressChange(value){ setForm({...form, site:value, addressStatus:'', lat:'', lon:''}) }
  function saveDay(){ const next = {...entries, [selected]: { ...form, updatedAt: new Date().toISOString(), user }}; setEntries(next); saveEntries(user,next); setEditing(false); setSuggestions([]) }
  function deleteDay(){ const next={...entries}; delete next[selected]; setEntries(next); saveEntries(user,next); setForm({site:'', people:'', notes:'', addressStatus:'', lat:'', lon:''}); setEditing(true) }
  function logout(){ handleLogout() }
  function exportJson(){
    const blob = new Blob([JSON.stringify(entries,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `calendario-lavoro-${user}-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url)
  }
  function importJson(e){
    const file=e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = () => { try { const data=JSON.parse(reader.result); setEntries(data); saveEntries(user,data); alert('Dati importati correttamente') } catch { alert('File non valido') } }
    reader.readAsText(file)
  }

  return <div className="app">
    <header className="hero">
      <div className="appIcon"><CalendarDays size={30}/></div>
      <div className="heroText"><h1>Calendario Lavoro</h1><p>Utente: <strong>{user}</strong> • calendario personale con festività, weekend, indirizzi e utenti approvati.</p></div>
      <button className="logoutBtn" onClick={logout}><LogOut size={17}/> Esci</button>
    </header>

    <main className="layout">
      <section className="card calendarCard">
        <div className="toolbar">
          <button onClick={()=>changeMonth(-1)} className="iconBtn"><ChevronLeft/></button>
          <div className="monthTitle"><strong>{MONTHS[month]} {year}</strong><span>{workDays} giornate • {totalPeople} presenze</span></div>
          <button onClick={()=>changeMonth(1)} className="iconBtn"><ChevronRight/></button>
        </div>
        <button onClick={goToday} className="todayBtn">Vai a oggi</button>
        <div className="legend"><span className="dot weekendDot"></span> Weekend <span className="dot holidayDot"></span> Festività <span className="dot workDot"></span> Giornata salvata</div>
        <div className="weekGrid">{DAYS.map((d,i)=><div key={d} className={i>4?'weekendHead':''}>{d}</div>)}</div>
        <div className="dayGrid">
          {calendarDays.map((d,i)=>{
            if(!d) return <div key={`b${i}`} className="blank" />
            const k=dateKey(d), has=!!entries[k], isToday=k===dateKey(today), isSelected=k===selected, holiday=holidays[k], weekend=isWeekend(d)
            return <button key={k} onClick={()=>openDay(k)} className={`day ${has?'has':''} ${isToday?'today':''} ${isSelected?'selected':''} ${holiday?'holiday':''} ${weekend?'weekend':''}`}>
              <span>{d.getDate()}</span>{holiday && <em>{holiday}</em>}{weekend && !holiday && <em>Weekend</em>}{has && <small>{entries[k].site || 'Lavoro'}</small>}
            </button>
          })}
        </div>
      </section>

      <section className="card editorCard">
        <div className="editorHeader">
          <div><h2>{niceDate(selected)}</h2><p>{selectedEntry ? 'Giornata registrata' : 'Nessun dato inserito'}</p>
            {selectedHoliday && <div className="holidayBadge"><PartyPopper size={16}/> {selectedHoliday}</div>}
            {selectedWeekend && <div className="weekendBadge">Sabato / Domenica</div>}
          </div>
          {selectedEntry && !editing && <button className="smallBtn" onClick={()=>setEditing(true)}><Pencil size={16}/> Modifica</button>}
        </div>
        {editing ? <div className="form">
          <label><MapPin size={17}/> Cantiere / indirizzo
            <div className="addressBox"><input value={form.site} onChange={e=>manualAddressChange(e.target.value)} placeholder="Es. Via Roma 10, Milano" autoComplete="off" />{addressLoading && <span className="addressIcon"><Search size={17}/></span>}</div>
            {form.addressStatus === 'verified' && <span className="okMsg"><CheckCircle2 size={15}/> Indirizzo verificato con coordinate</span>}
            {addressMessage && <span className={form.addressStatus === 'verified' ? 'okMsg' : 'warnMsg'}>{form.addressStatus === 'verified' ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>} {addressMessage}</span>}
            {suggestions.length > 0 && <div className="suggestions">{suggestions.map((s)=><button key={`${s.place_id}-${s.lat}`} type="button" onClick={()=>pickSuggestion(s)}><MapPin size={15}/><span>{s.display_name}</span></button>)}</div>}
          </label>
          <label><Users size={17}/> Numero persone<input type="number" min="0" value={form.people} onChange={e=>setForm({...form,people:e.target.value})} placeholder="Es. 2" /></label>
          <label><FileText size={17}/> Note<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Lavori eseguiti, materiali, promemoria..." /></label>
          <div className="actions"><button className="primary" onClick={saveDay}><Save size={18}/> Salva giornata</button>{selectedEntry && <button className="danger" onClick={deleteDay}><Trash2 size={18}/> Elimina</button>}<button className="ghost" onClick={()=>setEditing(false)}><X size={18}/> Annulla</button></div>
        </div> : selectedEntry ? <div className="readBox">
          <p><MapPin size={18}/><strong>Cantiere:</strong> {selectedEntry.site || 'Non indicato'}</p><p><Users size={18}/><strong>Persone:</strong> {selectedEntry.people || '0'}</p><p><FileText size={18}/><strong>Note:</strong> {selectedEntry.notes || 'Nessuna nota'}</p>
          {selectedEntry.addressStatus === 'verified' && <p><CheckCircle2 size={18}/><strong>Indirizzo:</strong> verificato {selectedEntry.lat && selectedEntry.lon ? `(${Number(selectedEntry.lat).toFixed(5)}, ${Number(selectedEntry.lon).toFixed(5)})` : ''}</p>}
        </div> : <button className="primary wide" onClick={()=>setEditing(true)}><Plus size={18}/> Aggiungi giornata</button>}
      </section>

      <section className="card listCard"><h2>Riepilogo mese</h2>{monthEntries.length===0 ? <p className="muted">Nessuna giornata registrata in questo mese.</p> : <div className="monthList">{monthEntries.map(([k,e])=><button key={k} onClick={()=>openDay(k)} className="row"><span>{parseKey(k).getDate()}</span><div><strong>{e.site || 'Lavoro'}</strong><small>{e.people || 0} persone {e.addressStatus === 'verified' ? '• indirizzo verificato' : ''}</small></div></button>)}</div>}</section>
      {isAdmin && <AdminPanel currentUser={user} onUserChanged={handleLogin}/>}
      <section className="card backupCard"><h2>Backup dati</h2><p className="muted">Backup del calendario dell’utente <strong>{user}</strong>. In questa versione i dati restano nel browser.</p><div className="actions"><button className="smallBtn" onClick={exportJson}><Download size={17}/> Esporta</button><label className="smallBtn fileBtn"><Upload size={17}/> Importa<input type="file" accept="application/json" onChange={importJson}/></label></div></section>
    </main>
  </div>
}
export default App
