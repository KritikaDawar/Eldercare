import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import{Heart,LayoutDashboard,Pill,Activity,ClipboardList,Users,LogOut,Plus,CheckCircle2,Clock,ShieldCheck,Menu, X,Trash2,Leaf,ArrowUpRight}from'lucide-react';import'./style.css';
const API=import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
function App(){const[token,setToken]=useState(localStorage.getItem('ec_token')||'');const[user,setUser]=useState(JSON.parse(localStorage.getItem('ec_user')||'null'));const[page,setPage]=useState('Dashboard');const[data,setData]=useState({medications:[],doses:[],activities:[],measurements:[],permissions:[]});const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[mobile,setMobile]=useState(false);
const headers=()=>({'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})});
async function api(path,method='GET',body){const r=await fetch(API+path,{method,headers:headers(),...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d}
async function refresh(){if(!token)return;try{const keys=['medications','doses','activities','measurements','permissions'];const vals=await Promise.all(keys.map(k=>api('/'+k)));setData(Object.fromEntries(keys.map((k,i)=>[k,vals[i]])))}catch(e){setMsg(e.message)}}
useEffect(()=>{refresh()},[token]);
               useEffect(() => {
  if (!token) return;

  const checkReminders = () => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const today = now.toLocaleDateString("en-CA");
    const currentTime = now.toTimeString().slice(0, 5);

    data.medications.forEach((med) => {
      if (med.schedule_time === currentTime) {
        const key = `reminder-${med.id}-${today}-${currentTime}`;

        if (!localStorage.getItem(key)) {
          new Notification("ElderCare medication reminder", {
            body: `Time to take ${med.name} (${med.dosage}). ${med.instructions || ""}`,
          });
          localStorage.setItem(key, "sent");
        }
      }
    });
  };

  checkReminders();
  const timer = setInterval(checkReminders, 30000);
  return () => clearInterval(timer);
}, [token, data.medications]);
async function submitAuth(e){e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);try{const d=await api('/auth/'+(f.get('mode')==='register'?'register':'login'),'POST',{name:f.get('name'),email:f.get('email'),password:f.get('password')});localStorage.setItem('ec_token',d.token);localStorage.setItem('ec_user',JSON.stringify(d.user));setToken(d.token);setUser(d.user)}catch(x){setMsg(x.message)}finally{setBusy(false)}}
function logout(){localStorage.clear();setToken('');setUser(null)}
async function act(fn){try{setMsg('');await fn();await refresh();setMsg('Saved successfully.')}catch(e){setMsg(e.message)}}
const nav=[['Dashboard',LayoutDashboard],['Medications',Pill],['Activity',Activity],['Health records',ClipboardList],['Caregiver sharing',Users]];
if(!token)return <Auth onSubmit={submitAuth} busy={busy} msg={msg}/>;
return <div className="app"><aside className={mobile?'side open':'side'}><div className="brand"><span className="brandicon"><Heart/></span><span>ElderCare<small>WELLNESS COMPANION</small></span><button className="mobileclose" onClick={()=>setMobile(false)}><X/></button></div><div className="navlabel">YOUR SPACE</div>{nav.map(([n,I])=><button key={n} className={'nav '+(page===n?'active':'')} onClick={()=>{setPage(n);setMobile(false)}}><I size={19}/>{n}</button>)}<div className="sidebottom"><div className="privacy"><ShieldCheck/><div><b>Your data, your choice</b><small>Caregiver sharing is optional and controlled by you.</small></div></div><button className="nav" onClick={logout}><LogOut size={18}/>Sign out</button></div></aside><main className="main"><header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div><div className="eyebrow">YOUR PERSONAL WELLNESS SPACE</div><h1>{page==='Dashboard'?'Good day':page}, {user?.name?.split(' ')[0]||'there'} <span className="wave">☀</span></h1></div><div className="profile"><span className="avatar">{user?.name?.[0]?.toUpperCase()}</span><div><b>{user?.name}</b><small>Personal account</small></div></div></header>{msg&&<div className="toast" onClick={()=>setMsg('')}>{msg} <X size={14}/></div>}
  <button className="primary" onClick={async () => {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    setMsg(permission === "granted"
      ? "Browser reminders enabled!"
      : "Please allow notifications in your browser settings.");
  } else {
    setMsg("Your browser does not support notifications.");
  }
}}>
  Enable medication notifications
</button>
{page==='Dashboard'&&<Dashboard data={data} setPage={setPage} user={user}/>}
{page==='Medications'&&<Medications data={data} act={act}/>}
{page==='Activity'&&<Activities data={data} act={act}/>}
{page==='Health records'&&<Health data={data} act={act}/>}
{page==='Caregiver sharing'&&<Sharing data={data} act={act}/>}
<footer><span>Made with care for everyday independence.</span><span>Demo MVP · Not a medical device</span></footer></main></div>}
function Auth({onSubmit,busy,msg}){const[mode,setMode]=useState('register');return <div className="authwrap"><div className="authcard"><div className="brand authbrand"><span className="brandicon"><Heart/></span><span>ElderCare<small>WELLNESS COMPANION</small></span></div><div className="authart"><div className="sun"></div><div className="authquote">A little care,<br/><i>every day.</i><small>Simple routines. More confidence. Greater peace of mind.</small></div></div><form onSubmit={onSubmit}><h2>{mode==='register'?'Create your account':'Welcome back'}</h2><p>Manage your daily wellness in one calm, simple place.</p><input type="hidden" name="mode" value={mode}/>{mode==='register'&&<><label>Your name</label><input name="name" placeholder="e.g. Asha Sharma" required/></>}<label>Email address</label><input name="email" type="email" placeholder="you@example.com" required/><label>Password</label><input name="password" type="password" minLength="8" placeholder="At least 8 characters" required/>{msg&&<div className="error">{msg}</div>}<button className="primary full" disabled={busy}>{busy?'Please wait…':mode==='register'?'Create account':'Sign in'}</button><div className="switch">{mode==='register'?'Already have an account?':'New to ElderCare?'} <button type="button" onClick={()=>setMode(mode==='register'?'login':'register')}>{mode==='register'?'Sign in':'Create account'}</button></div></form></div><div className="authfoot">Private by design · Caregiver access is always your choice</div></div>}
function SectionHead({eyebrow,title,desc,action}){return <div className="sectionhead"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{desc}</p></div>{action}</div>}
function Dashboard({data,setPage,user}){const taken=data.doses.filter(x=>x.status==='taken').length;return <><div className="welcome"><div><span className="pilltag"><Leaf size={14}/> A HEALTHIER ROUTINE STARTS HERE</span><h2>One step at a time.</h2><p>Keep track of the little things that help you feel your best.</p></div><div className="welcomeicon">🌿</div></div><div className="stats"><Stat icon={Pill} label="Your medicines" value={data.medications.length} sub="Active schedules"/><Stat icon={CheckCircle2} label="Doses recorded" value={taken} sub="Marked as taken"/><Stat icon={Activity} label="Activity entries" value={data.activities.length} sub="Wellness moments"/><Stat icon={ClipboardList} label="Health records" value={data.measurements.length} sub="Measurements saved"/></div><div className="dashgrid"><div className="panel"><div className="panelhead"><div><h3>Medication schedule</h3><p>Your saved daily routines</p></div><button className="textbtn" onClick={()=>setPage('Medications')}>View all <ArrowUpRight size={15}/></button></div>{data.medications.length?data.medications.slice(0,4).map(m=><div className="medrow" key={m.id}><div className="medicon"><Pill/></div><div className="medinfo"><b>{m.name}</b><small>{m.dosage} · {m.instructions||'As prescribed'}</small></div><span className="time"><Clock size={14}/>{m.schedule_time}</span></div>):<Empty icon={Pill} title="No medicines added yet" text="Add a prescribed medicine to start organising your routine." button="Add medication" onClick={()=>setPage('Medications')}/>}</div><div className="panel"><div className="panelhead"><div><h3>Wellness at a glance</h3><p>Your recent activity</p></div></div><div className="miniwell"><span className="roundicon mint"><Activity/></span><div><b>{data.activities.reduce((s,a)=>s+a.minutes,0)} min</b><small>Activity minutes recorded</small></div></div><div className="miniwell"><span className="roundicon peach"><ClipboardList/></span><div><b>{data.measurements.length} entries</b><small>Health measurements saved</small></div></div><div className="tip"><b>A gentle reminder</b><p>Small, consistent habits can make everyday routines easier. Follow the care plan agreed with your healthcare professional.</p></div></div></div></>}
function Stat({icon:I,label,value,sub}){return <div className="stat"><span className="staticon"><I/></span><div><small>{label}</small><strong>{value}</strong><span>{sub}</span></div></div>}
function Empty({icon:I,title,text,button,onClick}){return <div className="empty"><span><I/></span><b>{title}</b><p>{text}</p>{button&&<button className="primary" onClick={onClick}><Plus size={16}/>{button}</button>}</div>}
function Medications({data,act}){const[show,setShow]=useState(false);return <><SectionHead eyebrow="MEDICATION ROUTINE" title="Your medicines" desc="Keep your prescribed medication schedule organised." action={<button className="primary" onClick={()=>setShow(!show)}><Plus size={17}/> Add medicine</button>}/>{show&&<form className="formpanel" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;let f=new FormData(form);act(async()=>{await apiPost('/medications',{name:f.get('name'),dosage:f.get('dosage'),schedule_time:f.get('time'),instructions:f.get('instructions')});setShow(false)})}}><h3>New medication</h3><div className="formgrid"><Field label="Medicine name"><input name="name" required placeholder="Medicine name"/></Field><Field label="Dosage"><input name="dosage" required placeholder="e.g. 1 tablet"/></Field><Field label="Reminder time"><input name="time" type="time" required/></Field><Field label="Instructions"><input name="instructions" placeholder="e.g. After food"/></Field></div><button className="primary">Save medication</button></form>}<div className="panel">{data.medications.length?data.medications.map(m=><div className="medrow large" key={m.id}><div className="medicon"><Pill/></div><div className="medinfo"><b>{m.name}</b><small>{m.dosage} · {m.instructions||'No additional instructions'}</small></div><span className="time"><Clock size={14}/>{m.schedule_time}</span><button className="iconbtn" title="Delete" onClick={()=>act(()=>apiDelete('/medications/'+m.id))}><Trash2 size={17}/></button><button className="softbtn" onClick={()=>act(()=>apiPost('/doses',{medication_id:m.id,status:'taken'}))}>Log taken</button><button className="softbtn" onClick={()=>act(()=>apiPost('/doses',{medication_id:m.id,status:'skipped'}))}>Log skipped</button></div>):<Empty icon={Pill} title="Your medication list is empty" text="Add medicines exactly as prescribed by your healthcare professional."/>}</div><div className="panel mt"><h3>Recent dose activity</h3>{data.doses.length?data.doses.slice(0,8).map(d=><div className="listrow" key={d.id}><span>{d.medication}</span><small>{d.scheduled_for}</small><span className={'status '+d.status}>{d.status}</span></div>):<p className="muted">Dose entries will appear here when you log them.</p>}</div></>}
let tokenGet=()=>localStorage.getItem('ec_token');async function apiPost(p,b){let r=await fetch(API+p,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenGet()},body:JSON.stringify(b)});let d=await r.json();if(!r.ok)throw Error(d.error);return d}async function apiDelete(p){let r=await fetch(API+p,{method:'DELETE',headers:{Authorization:'Bearer '+tokenGet()}});let d=await r.json();if(!r.ok)throw Error(d.error);return d}
function Field({label,children}){return <div className="field"><label>{label}</label>{children}</div>}
function Activities({ data, act }) {
  return (
    <>
      <SectionHead
        eyebrow="MOVEMENT & WELLBEING"
        title="Activity tracker"
        desc="Celebrate movement in whatever way works for you."
      />
      <form
        className="formpanel"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          act(async () => {
            await apiPost('/activities', {
              activity: f.get('activity'),
              minutes: f.get('minutes'),
              activity_date: f.get('date'),
            });
            form.reset();
          });
        }}
      >
        <h3>Record an activity</h3>
        <div className="formgrid">
          <Field label="Activity">
            <input name="activity" placeholder="e.g. Morning walk" required />
          </Field>
          <Field label="Duration (minutes)">
            <input name="minutes" type="number" min="1" max="1440" required placeholder="20" />
          </Field>
          <Field label="Date">
            <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
        </div>
        <button className="primary"><Plus size={16} /> Save activity</button>
      </form>
      <div className="panel mt">
        <h3>Activity history</h3>
        {data.activities.length > 0 ? (
          data.activities.map((x) => (
            <div className="listrow" key={x.id}>
              <b>{x.activity}</b>
              <small>{x.activity_date}</small>
              <span className="status taken">{x.minutes} min</span>
            </div>
          ))
        ) : (
          <Empty icon={Activity} title="No activity logged yet" text="Your activity entries will build a simple personal history." />
        )}
      </div>
    </>
  );
}

function Health({ data, act }) {
  return (
    <>
      <SectionHead
        eyebrow="PERSONAL HEALTH JOURNAL"
        title="Health records"
        desc="Keep a record of measurements you choose to track."
      />
      <form
        className="formpanel"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          act(async () => {
            await apiPost('/measurements', {
              kind: f.get('kind'),
              value: f.get('value'),
              unit: f.get('unit'),
              recorded_at: new Date().toISOString().slice(0, 16),
            });
            form.reset();
          });
        }}
      >
        <h3>Add a measurement</h3>
        <div className="formgrid">
          <Field label="Measurement">
            <select name="kind">
              <option value="blood_pressure">Blood pressure</option>
              <option value="cholesterol">Cholesterol</option>
              <option value="weight">Weight</option>
            </select>
          </Field>
          <Field label="Value">
            <input name="value" required placeholder="e.g. 120/80" />
          </Field>
          <Field label="Unit">
            <input name="unit" required placeholder="e.g. mmHg, mg/dL, kg" />
          </Field>
        </div>
        <button className="primary"><Plus size={16} /> Save measurement</button>
      </form>
      <div className="panel mt">
        <h3>Measurement history</h3>
        {data.measurements.length > 0 ? (
          data.measurements.map((x) => (
            <div className="listrow" key={x.id}>
              <b>{x.kind.replace('_', ' ')}</b>
              <strong>{x.value} {x.unit}</strong>
              <small>{x.recorded_at}</small>
            </div>
          ))
        ) : (
          <Empty icon={ClipboardList} title="No measurements recorded" text="Add a measurement to start your personal health journal." />
        )}
      </div>
      <p className="notice">
        <ShieldCheck size={17} /> These are self-recorded values, not clinical interpretation. Discuss readings with a qualified healthcare professional.
      </p>
    </>
  );
}

function Sharing({data,act}){return <><SectionHead eyebrow="YOUR PRIVACY CONTROLS" title="Caregiver sharing" desc="Choose whether to share selected summaries with someone you trust."/><div className="notice"><ShieldCheck size={19}/> Sharing is optional. Only the scopes you select are included. You can revoke access at any time.</div><form className="formpanel" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;let f=new FormData(form);act(()=>apiPost('/permissions',{caregiver_email:f.get('email'),scopes:f.getAll('scope')}));e.currentTarget.reset()}}><h3>Invite a caregiver</h3><Field label="Caregiver account email"><input name="email" type="email" required placeholder="caregiver@example.com"/></Field><p className="muted">Select what this person can view:</p><div className="checks"><label><input type="checkbox" name="scope" value="medications"/> Medication schedule and dose log</label><label><input type="checkbox" name="scope" value="activity"/> Activity entries</label><label><input type="checkbox" name="scope" value="health"/> Health measurements</label></div><button className="primary">Grant selected access</button></form><div className="panel mt"><h3>Sharing permissions</h3>{data.permissions.length?data.permissions.map(p=><div className="listrow permission" key={p.id}><div><b>{p.caregiver_email}</b><small>{p.scopes.join(' · ')}</small></div><span className={'status '+(p.active?'taken':'missed')}>{p.active?'Active':'Revoked'}</span>{p.active&&<button className="softbtn danger" onClick={()=>act(()=>apiDelete('/permissions/'+p.id))}>Revoke access</button>}</div>):<p className="muted">No caregiver permissions have been created.</p>}</div></>}

createRoot(document.getElementById('root')).render(<App/>);
