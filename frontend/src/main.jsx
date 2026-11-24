import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import{Heart,LayoutDashboard,Pill,Activity,ClipboardList,Users,LogOut,Plus,CheckCircle2,Clock,ShieldCheck,Menu, X,Trash2,Leaf,ArrowUpRight}from'lucide-react';import'./style.css';
const API=import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

function notifySessionExpired() {
  window.dispatchEvent(new Event('ec-session-expired'));
}
function App(){const[token,setToken]=useState(localStorage.getItem('ec_token')||'');const[user,setUser]=useState(JSON.parse(localStorage.getItem('ec_user')||'null'));const[page,setPage]=useState('Dashboard');const[data,setData]=useState({medications:[],doses:[],activities:[],measurements:[],permissions:[]});const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[mobile,setMobile]=useState(false);const[caregiverOwnerEmail,setCaregiverOwnerEmail]=useState('');const[caregiverSummary,setCaregiverSummary]=useState(null);const[caregiverLoading,setCaregiverLoading]=useState(false);
const headers=()=>({'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})});
async function api(path,method='GET',body){
  const r=await fetch(API+path,{
    method,
    headers:headers(),
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const d=await r.json();
  if(r.status===401 && token){
    notifySessionExpired();
    throw Error("Your session has expired. Please log in again.");
  }
  if(!r.ok) throw Error(d.error || 'Request failed');
  return d;
}
async function refresh(){
  if(!token) return;
  try {
    const keys=['medications','doses','activities','measurements','permissions'];
    const vals=await Promise.all(keys.map(k=>api('/'+k)));
    setData(Object.fromEntries(keys.map((k,i)=>[k,vals[i]])));
  } catch(e) {
    setMsg(e.message);
  }
}
useEffect(()=>{refresh()},[token]);

useEffect(() => {
  const handleExpired = () => {
    localStorage.removeItem('ec_token');
    localStorage.removeItem('ec_user');
    setToken('');
    setUser(null);
    setData({
      medications: [],
      doses: [],
      activities: [],
      measurements: [],
      permissions: []
    });
    setMsg("Your session has expired. Please log in again.");
  };

  window.addEventListener('ec-session-expired', handleExpired);
  return () => window.removeEventListener('ec-session-expired', handleExpired);
}, []);
               useEffect(() => {
  if (!token) return;

  const expiry = getTokenExpiry(token);
  const remaining = expiry - Date.now();

  if (remaining <= 0) {
    logout();
    setMsg("Your session has expired. Please log in again.");
    return;
  }

  const timer = setTimeout(() => {
    logout();
    setMsg("Your session has expired. Please log in again.");
  }, remaining);

  return () => clearTimeout(timer);
}, [token]);
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
function logout(){
  localStorage.removeItem('ec_token');
  localStorage.removeItem('ec_user');
  setToken('');
  setUser(null);
  setData({
    medications: [],
    doses: [],
    activities: [],
    measurements: [],
    permissions: []
  });
  setCaregiverSummary(null);
  setCaregiverOwnerEmail('');
}
async function act(fn){try{setMsg('');await fn();await refresh();setMsg('Saved successfully.')}catch(e){setMsg(e.message)}}
async function loadCaregiverSummary(e){
  if(e) e.preventDefault();
  const email=caregiverOwnerEmail.trim().toLowerCase();
  if(!email || !email.includes('@')){
    setMsg('Please enter the elderly person’s registered email address.');
    return;
  }
  setCaregiverLoading(true);
  setMsg('');
  setCaregiverSummary(null);
  try{
    const result=await api('/caregiver/summary?owner_email='+encodeURIComponent(email));
    setCaregiverSummary(result);
    setMsg('Caregiver information loaded successfully.');
  }catch(error){
    setMsg(error.message || 'Unable to load caregiver information.');
  }finally{
    setCaregiverLoading(false);
  }
}
async function caregiverCreateMedication(payload){
  await api('/caregiver/medications','POST',{...payload,owner_email:caregiverOwnerEmail});
  await loadCaregiverSummary();
  setMsg('Medication reminder added.');
}
async function caregiverUpdateMedication(id,payload){
  await api('/caregiver/medications/'+id,'PATCH',{...payload,owner_email:caregiverOwnerEmail});
  await loadCaregiverSummary();
  setMsg('Care schedule updated.');
}
async function caregiverLogDose(payload){
  await api('/caregiver/doses','POST',{...payload,owner_email:caregiverOwnerEmail});
  await loadCaregiverSummary();
  setMsg('Dose activity recorded.');
}
const nav=[['Dashboard',LayoutDashboard],['Medications',Pill],['Activity',Activity],['Health records',ClipboardList],['Caregiver sharing',Users],['Caregiver dashboard',Users]];
if(!token)return <Auth onSubmit={submitAuth} busy={busy} msg={msg}/>;
return <div className="app"><style>{`
:root{
 --ec-bg:#dce8df;--ec-panel:#f4f7f1;--ec-panel-soft:#e9f0e8;
 --ec-green:#315f49;--ec-green-deep:#214735;--ec-green-mid:#56836a;
 --ec-sage:#a9c1a9;--ec-olive:#a4a66b;--ec-gold:#d2b878;
 --ec-ink:#263d31;--ec-muted:#718277;--ec-border:#d1dfd2;
}
html,body,#root{min-height:100%;background:#dce8df!important}
body{color:var(--ec-ink)!important}
.app{min-height:100vh;background:linear-gradient(135deg,#dce8df 0%,#e8eddf 48%,#d2e2d7 100%)!important;color:var(--ec-ink)!important}
.side{background:linear-gradient(180deg,#e9f0e8 0%,#dce9df 100%)!important;border-right:1px solid #cbdaca!important}
.main{background:transparent!important}
.main header{background:rgba(239,245,237,.92)!important;border-bottom:1px solid #cbdaca!important;backdrop-filter:blur(12px)}
.brand,.brand small,.navlabel,.eyebrow{color:#426c50!important}
.brandicon{background:linear-gradient(145deg,#c8d9c6,#a9c4ae)!important;color:#315f49!important}
.nav{color:#526c5b!important;border-radius:13px!important}
.nav:hover,.nav.active{background:linear-gradient(100deg,#c4d8c4,#d9dfbd)!important;color:#244b36!important}
.nav.active{box-shadow:inset 3px 0 0 #648b5e!important}
.panel,.formpanel,.stat,.listrow,.empty,.profile,.sectionhead,.main .panel{background:#f4f7f1!important;border:1px solid #d1dfd2!important;box-shadow:0 9px 25px rgba(39,77,52,.08)!important}
.panelhead h3,.panel h3,.sectionhead h2{color:#31533d!important}
.panelhead p,.muted,.panel p{color:#718277!important}
.field input,.field select,.field textarea,input,select,textarea{background:#f8faf5!important;border:1px solid #cbdaca!important;color:#294434!important;border-radius:12px}
.field input:focus,.field select:focus,.field textarea:focus,input:focus,select:focus,textarea:focus{outline:2px solid #91b39a!important;border-color:#648b70!important}
.primary{background:linear-gradient(120deg,#315f49,#56836a)!important;color:#fff!important;border:0!important;box-shadow:0 7px 18px rgba(38,83,55,.2)!important}
.primary:hover{filter:brightness(1.07)}
.softbtn,.iconbtn{background:#dce9dd!important;color:#315f49!important;border:1px solid #c2d6c5!important}
.textbtn{color:#477856!important}
.medrow,.listrow,.miniwell{background:#eaf1e8!important;border-color:#d1dfd2!important}
.medicon,.roundicon,.staticon{background:#d7e6d7!important;color:#477454!important}
.time,.status.taken{background:#dce9d9!important;color:#416b4a!important}
.error{background:#f8e5df!important;color:#8c5145!important;border:1px solid #e9c9bc!important}
.toast{background:#f4f7f1!important;color:#31533d!important;border:1px solid #d1dfd2!important}
.main .panel button:not(.primary){color:#477856}
.auth-warm-card{background:#f4f7f1!important}
@media(max-width:760px){.side{box-shadow:12px 0 35px rgba(38,70,47,.16)!important}}

/* Visual alignment and readable rhythm */
.app{width:100%;}
.main{min-width:0;}
.main>header{gap:22px;min-height:104px;padding:22px clamp(20px,3vw,42px)!important;}
.main>header h1{font-size:clamp(22px,2.2vw,30px)!important;line-height:1.2!important;letter-spacing:-.55px;margin:5px 0 0!important;}
.main>header .eyebrow{font-size:10px;letter-spacing:1.45px;font-weight:800;}
.main>header .profile{flex-shrink:0;}
.main> :not(header):not(footer){max-width:1180px;margin-left:auto;margin-right:auto;}
.main>.toast{max-width:1180px;margin:16px auto!important;}
.notification-bar{width:calc(100% - 2px);box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 18px;margin:20px auto 24px!important;border:1px solid #cfddcf;border-radius:16px;background:rgba(244,247,241,.92);box-shadow:0 5px 16px rgba(39,77,52,.055);}
.notification-copy{display:flex;align-items:center;gap:12px;min-width:0;}
.notification-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:12px;background:#dce9dd;color:#315f49;}
.notification-copy strong{display:block;color:#31533d;font-size:13px;line-height:1.35;margin-bottom:3px;}
.notification-copy span:not(.notification-icon){display:block;color:#718277;font-size:12px;line-height:1.45;}
.notification-button{flex:0 0 auto;min-height:40px;padding:0 17px!important;border-radius:11px!important;font-size:12px!important;font-weight:750!important;white-space:nowrap;}
.sectionhead{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:22px 24px!important;border-radius:18px!important;margin:22px 0 16px!important;}
.sectionhead>div{min-width:0;}
.sectionhead h2{font-size:clamp(21px,2vw,27px)!important;line-height:1.22!important;letter-spacing:-.45px;margin:5px 0 6px!important;}
.sectionhead p{font-size:13px;line-height:1.55;margin:0!important;max-width:650px;}
.panel,.formpanel{box-sizing:border-box;border-radius:18px!important;padding:22px!important;margin-top:16px!important;}
.panel h3,.formpanel h3{font-size:17px;line-height:1.35;letter-spacing:-.2px;margin:0 0 12px;color:#31533d;}
.panel p,.formpanel p{line-height:1.6;}
.formgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px;margin:16px 0;}
.field{display:flex;flex-direction:column;gap:7px;min-width:0;}
.field label{font-size:12px;font-weight:750;line-height:1.4;color:#496653;}
.field input,.field select,.field textarea{width:100%;min-height:44px;box-sizing:border-box;padding:10px 12px;font-size:13px;line-height:1.4;}
.formpanel>.primary,.formpanel>button.primary{min-height:42px;padding:0 18px;border-radius:11px;font-size:13px;font-weight:750;}
.primary,.softbtn,.iconbtn,.textbtn{font-family:inherit;line-height:1.25;}
.primary,.softbtn{min-height:38px;padding:9px 14px;border-radius:10px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.listrow{display:flex;align-items:center;gap:14px;padding:13px 15px!important;margin:9px 0;border-radius:13px!important;min-width:0;}
.listrow>div:first-child{min-width:0;}
.listrow b,.listrow strong{font-size:13px;line-height:1.4;color:#31533d;}
.listrow small{font-size:11px;line-height:1.45;color:#718277;}
.status,.time{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:5px 10px;border-radius:9px;font-size:11px;font-weight:750;white-space:nowrap;}
.checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;margin:14px 0 18px;}
.checks label{display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border:1px solid #d5e1d5;border-radius:11px;background:#edf3eb;color:#476453;font-size:12px;line-height:1.45;}
.checks input{width:16px;height:16px;flex:0 0 16px;margin:1px 0 0;accent-color:#477856;}
.notice{display:flex;align-items:flex-start;gap:10px;padding:13px 15px!important;border-radius:13px;line-height:1.55!important;font-size:12px!important;background:#edf4ed;border:1px solid #d6e3d6;color:#5f7766;}
.notice svg{flex:0 0 auto;margin-top:1px;}
.toast{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:12px;font-size:12px;line-height:1.45;}
footer{max-width:1180px;margin:28px auto 0!important;padding:18px 22px!important;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#718277;font-size:11px;}
button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #9bbda1!important;outline-offset:2px;}
@media(max-width:760px){
 .main>header{min-height:84px;padding:16px 18px!important;gap:12px;}
 .main>header .profile{display:none;}
 .notification-bar{align-items:stretch;flex-direction:column;padding:14px;margin:14px auto 18px!important;}
 .notification-button{width:100%;}
 .sectionhead{align-items:flex-start;flex-direction:column;padding:18px!important;}
 .sectionhead>.primary,.sectionhead>button{width:100%;}
 .formgrid,.checks{grid-template-columns:minmax(0,1fr);}
 .panel,.formpanel{padding:17px!important;}
 .listrow{align-items:flex-start;flex-wrap:wrap;gap:9px;}
 footer{padding:16px 18px!important;}
}
`}</style><aside className={mobile?'side open':'side'}><div className="brand"><span className="brandicon"><Heart/></span><span>ElderCare<small>WELLNESS COMPANION</small></span><button className="mobileclose" onClick={()=>setMobile(false)}><X/></button></div><div className="navlabel">YOUR SPACE</div>{nav.map(([n,I])=><button key={n} className={'nav '+(page===n?'active':'')} onClick={()=>{setPage(n);setMobile(false)}}><I size={19}/>{n}</button>)}<div className="sidebottom"><div className="privacy"><ShieldCheck/><div><b>Your data, your choice</b><small>Caregiver sharing is optional and controlled by you.</small></div></div><button className="nav" onClick={logout}><LogOut size={18}/>Sign out</button></div></aside><main className="main"><header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div><div className="eyebrow">YOUR PERSONAL WELLNESS SPACE</div><h1>{page==='Dashboard'?'Good day':page}, {user?.name?.split(' ')[0]||'there'} <span className="wave">☀</span></h1></div></header>{msg&&<div className="toast" onClick={()=>setMsg('')}>{msg} <X size={14}/></div>}
  <div className="notification-bar">
    <div className="notification-copy">
      <span className="notification-icon"><Clock size={18}/></span>
      <div>
        <strong>Medication alerts</strong>
        <span>Get a gentle browser notification when it is time for a scheduled dose.</span>
      </div>
    </div>
    <button className="primary notification-button" onClick={async () => {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        setMsg(permission === "granted"
          ? "Browser reminders enabled!"
          : "Please allow notifications in your browser settings.");
      } else {
        setMsg("Your browser does not support notifications.");
      }
    }}>
      Enable notifications
    </button>
  </div>
{page==='Dashboard'&&<Dashboard data={data} setPage={setPage} user={user}/>}
{page==='Medications'&&<Medications data={data} act={act}/>}
{page==='Activity'&&<Activities data={data} act={act}/>}
{page==='Health records'&&<Health data={data} act={act}/>}
{page==='Caregiver sharing'&&<Sharing data={data} act={act}/>}
{page==='Caregiver dashboard'&&<CaregiverDashboard ownerEmail={caregiverOwnerEmail} setOwnerEmail={setCaregiverOwnerEmail} summary={caregiverSummary} loading={caregiverLoading} onLookup={loadCaregiverSummary} onClear={()=>setCaregiverSummary(null)} onCreateMedication={caregiverCreateMedication} onUpdateMedication={caregiverUpdateMedication} onLogDose={caregiverLogDose}/>}
<footer><span>Made with care for everyday independence.</span><span>Demo MVP · Not a medical device</span></footer></main></div>}
function Auth({onSubmit,busy,msg}){
  const[mode,setMode]=useState('register');
  const isRegister=mode==='register';
  const pageStyle={minHeight:'100vh',background:'linear-gradient(135deg,#dce8df 0%,#e8eddf 52%,#d2e2d7 100%)',padding:'clamp(18px,4vw,54px)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'};
  const shellStyle={width:'min(1180px,100%)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,390px),1fr))',background:'#f4f7f1',borderRadius:30,overflow:'hidden',boxShadow:'0 28px 90px rgba(38,75,57,.13)',border:'1px solid #e4eee6'};
  return <div style={pageStyle}><style>{`
:root{
 --ec-bg:#dce8df;--ec-panel:#f4f7f1;--ec-panel-soft:#e9f0e8;
 --ec-green:#315f49;--ec-green-deep:#214735;--ec-green-mid:#56836a;
 --ec-sage:#a9c1a9;--ec-olive:#a4a66b;--ec-gold:#d2b878;
 --ec-ink:#263d31;--ec-muted:#718277;--ec-border:#d1dfd2;
}
html,body,#root{min-height:100%;background:#dce8df!important}
body{color:var(--ec-ink)!important}
.app{min-height:100vh;background:linear-gradient(135deg,#dce8df 0%,#e8eddf 48%,#d2e2d7 100%)!important;color:var(--ec-ink)!important}
.side{background:linear-gradient(180deg,#e9f0e8 0%,#dce9df 100%)!important;border-right:1px solid #cbdaca!important}
.main{background:transparent!important}
.main header{background:rgba(239,245,237,.92)!important;border-bottom:1px solid #cbdaca!important;backdrop-filter:blur(12px)}
.brand,.brand small,.navlabel,.eyebrow{color:#426c50!important}
.brandicon{background:linear-gradient(145deg,#c8d9c6,#a9c4ae)!important;color:#315f49!important}
.nav{color:#526c5b!important;border-radius:13px!important}
.nav:hover,.nav.active{background:linear-gradient(100deg,#c4d8c4,#d9dfbd)!important;color:#244b36!important}
.nav.active{box-shadow:inset 3px 0 0 #648b5e!important}
.panel,.formpanel,.stat,.listrow,.empty,.profile,.sectionhead,.main .panel{background:#f4f7f1!important;border:1px solid #d1dfd2!important;box-shadow:0 9px 25px rgba(39,77,52,.08)!important}
.panelhead h3,.panel h3,.sectionhead h2{color:#31533d!important}
.panelhead p,.muted,.panel p{color:#718277!important}
.field input,.field select,.field textarea,input,select,textarea{background:#f8faf5!important;border:1px solid #cbdaca!important;color:#294434!important;border-radius:12px}
.field input:focus,.field select:focus,.field textarea:focus,input:focus,select:focus,textarea:focus{outline:2px solid #91b39a!important;border-color:#648b70!important}
.primary{background:linear-gradient(120deg,#315f49,#56836a)!important;color:#fff!important;border:0!important;box-shadow:0 7px 18px rgba(38,83,55,.2)!important}
.primary:hover{filter:brightness(1.07)}
.softbtn,.iconbtn{background:#dce9dd!important;color:#315f49!important;border:1px solid #c2d6c5!important}
.textbtn{color:#477856!important}
.medrow,.listrow,.miniwell{background:#eaf1e8!important;border-color:#d1dfd2!important}
.medicon,.roundicon,.staticon{background:#d7e6d7!important;color:#477454!important}
.time,.status.taken{background:#dce9d9!important;color:#416b4a!important}
.error{background:#f8e5df!important;color:#8c5145!important;border:1px solid #e9c9bc!important}
.toast{background:#f4f7f1!important;color:#31533d!important;border:1px solid #d1dfd2!important}
.main .panel button:not(.primary){color:#477856}
.auth-warm-card{background:#f4f7f1!important}
@media(max-width:760px){.side{box-shadow:12px 0 35px rgba(38,70,47,.16)!important}}
`}</style>
    <div style={shellStyle}>
      <section style={{padding:'clamp(28px,5vw,62px)',backgroundImage:'linear-gradient(90deg,rgba(220,235,222,.84) 0%,rgba(226,236,219,.70) 54%,rgba(218,233,221,.38) 100%),url(/eldercare-care-hands.png)',backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat',display:'flex',flexDirection:'column',justifyContent:'space-between',gap:34,minHeight:600}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,color:'#214c3c',fontSize:25,fontWeight:800,letterSpacing:'-.7px'}}>
            <span style={{width:48,height:48,borderRadius:16,display:'grid',placeItems:'center',background:'#fff',boxShadow:'0 6px 20px #234b3514'}}><Heart size={25}/></span>
            <span>ElderCare<small style={{display:'block',fontSize:9,letterSpacing:2.4,fontWeight:700,color:'#789184',marginTop:3}}>WELLNESS COMPANION</small></span>
          </div>
          <div style={{marginTop:65,maxWidth:500}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 13px',borderRadius:99,background:'#ffffffb8',color:'#47745c',fontSize:11,fontWeight:800,letterSpacing:1.2}}><Leaf size={15}/> CARE THAT FEELS CLOSER</div>
            <h1 style={{fontSize:'clamp(38px,5vw,58px)',lineHeight:1.06,letterSpacing:'-2px',color:'#173c30',margin:'22px 0 16px'}}>A little more care.<br/><span style={{color:'#6b9b78'}}>A lot more peace.</span></h1>
            <p style={{fontSize:17,lineHeight:1.75,color:'#61796b',maxWidth:440,margin:0}}>Everyday wellbeing, thoughtful reminders and family connection — together in one calm, simple space.</p>
          </div>
        </div>
        <div style={{display:'grid',gap:12}}>
          {[
            ['01','Gentle daily routines','Keep medicines, movement and health notes organised.'],
            ['02','Care that stays connected','Share selected updates with people you trust.'],
            ['03','Your choices come first','You decide what to record and what to share.']
          ].map(([n,t,d])=><div key={n} style={{display:'flex',gap:15,alignItems:'flex-start',padding:'15px 17px',borderRadius:17,background:'#ffffffb8',border:'1px solid #ffffff'}}>
            <b style={{fontSize:12,color:'#82a48b',paddingTop:3}}>{n}</b><div><b style={{display:'block',color:'#294d3c',fontSize:14}}>{t}</b><span style={{display:'block',color:'#718477',fontSize:12,lineHeight:1.5,marginTop:4}}>{d}</span></div>
          </div>)}
        </div>
        <div style={{color:'#819488',fontSize:11}}>A supportive companion for everyday care · Not a medical device</div>
      </section>
      <section style={{padding:'clamp(28px,5vw,62px)',display:'flex',flexDirection:'column',justifyContent:'center'}}>
        <div style={{maxWidth:430,width:'100%',margin:'0 auto'}}>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:'#7b9b85'}}>WELCOME TO ELDERCARE</div>
          <h2 style={{fontSize:34,letterSpacing:'-1px',color:'#1d3e31',margin:'13px 0 8px'}}>{isRegister?'Let’s make care simpler.':'It’s good to see you again.'}</h2>
          <p style={{color:'#829188',lineHeight:1.65,margin:'0 0 28px'}}>{isRegister?'Create your personal space and take the first step toward a more organised routine.':'Sign in to pick up right where you left off.'}</p>
          <form onSubmit={onSubmit} style={{display:'grid',gap:12}}>
            <input type="hidden" name="mode" value={mode}/>
            {isRegister&&<><label style={{fontSize:13,fontWeight:700,color:'#476453'}}>Your name</label><input name="name" placeholder="e.g. Asha Sharma" required style={authInputStyle}/></>}
            <label style={{fontSize:13,fontWeight:700,color:'#476453'}}>Email address</label>
            <input name="email" type="email" placeholder="you@example.com" required style={authInputStyle}/>
            <label style={{fontSize:13,fontWeight:700,color:'#476453'}}>Password</label>
            <input name="password" type="password" minLength="8" placeholder="At least 8 characters" required style={authInputStyle}/>
            {msg&&<div className="error">{msg}</div>}
            <button className="primary full" disabled={busy} style={{marginTop:10,minHeight:52,borderRadius:14,fontSize:15,fontWeight:800}}>{busy?'Please wait…':isRegister?'Create my account':'Sign in to ElderCare'}</button>
          </form>
          <div style={{textAlign:'center',color:'#819087',fontSize:13,marginTop:22}}>{isRegister?'Already have an account?':'New to ElderCare?'} <button type="button" onClick={()=>setMode(isRegister?'login':'register')} style={{border:0,background:'none',color:'#397858',fontWeight:800,cursor:'pointer',fontSize:13}}>{isRegister?'Sign in':'Create an account'}</button></div>
          <div style={{marginTop:30,padding:'13px 15px',borderRadius:13,background:'#f3f8f4',color:'#718779',fontSize:11,lineHeight:1.6,display:'flex',gap:9,alignItems:'center'}}><ShieldCheck size={18} color="#5e9270"/> Your caregiver sharing is optional and stays under your control.</div>
        </div>
      </section>
    </div>
  </div>;
}
const authInputStyle={width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:'1px solid #dce8df',background:'#fbfdfb',fontSize:14,color:'#294638',outlineColor:'#78a987'};

function SectionHead({eyebrow,title,desc,action}){return <div className="sectionhead"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{desc}</p></div>{action}</div>}
function Dashboard({data,setPage,user}){
  const taken=data.doses.filter(x=>x.status==='taken').length;
  const cards=[
    {icon:Pill,label:'Your medicines',value:data.medications.length,detail:'Active schedules',page:'Medications'},
    {icon:CheckCircle2,label:'Doses recorded',value:taken,detail:'Marked as taken',page:'Medications'},
    {icon:Activity,label:'Activity entries',value:data.activities.length,detail:'Wellness moments',page:'Activity'},
    {icon:ClipboardList,label:'Health records',value:data.measurements.length,detail:'Measurements saved',page:'Health records'}
  ];
  return <div style={{display:'grid',gap:22}}>
    <section style={{position:'relative',overflow:'hidden',borderRadius:26,padding:'clamp(25px,4vw,42px)',backgroundImage:'linear-gradient(100deg,rgba(29,70,51,.88) 0%,rgba(44,91,64,.74) 58%,rgba(47,91,65,.42) 100%),url(/eldercare-family-walk.png)',backgroundSize:'cover',backgroundPosition:'center 42%',color:'#fff',boxShadow:'0 16px 38px #244f3a20'}}>
      <div style={{position:'absolute',right:-35,top:-80,width:300,height:300,borderRadius:'50%',border:'1px solid #ffffff25'}}></div>
      <div style={{position:'absolute',right:45,bottom:-100,width:220,height:220,borderRadius:'50%',background:'#ffffff0c'}}></div>
      <div style={{position:'relative',zIndex:1,maxWidth:650}}>
        <span style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 13px',borderRadius:99,background:'#ffffff20',fontSize:10,fontWeight:800,letterSpacing:1.4}}><Leaf size={14}/> YOUR WELLNESS, YOUR PACE</span>
        <h2 style={{fontSize:'clamp(30px,4vw,45px)',lineHeight:1.1,letterSpacing:'-1.4px',margin:'22px 0 12px'}}>Every day is a fresh<br/>chance to feel cared for.</h2>
        <p style={{fontSize:15,lineHeight:1.75,color:'#e2eee5',maxWidth:520,margin:'0 0 23px'}}>Hello {user?.name?.split(' ')[0]||'there'} — keep your daily routines close, celebrate small steps and stay connected with the people who care.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          <button onClick={()=>setPage('Medications')} style={{border:0,borderRadius:12,padding:'12px 17px',background:'#fff',color:'#28543e',fontWeight:800,cursor:'pointer'}}>View medication routine</button>
          <button onClick={()=>setPage('Caregiver sharing')} style={{border:'1px solid #ffffff70',borderRadius:12,padding:'12px 17px',background:'#ffffff12',color:'#fff',fontWeight:700,cursor:'pointer'}}>Manage caregiver sharing</button>
        </div>
      </div>
      <div style={{position:'absolute',right:'7%',top:'26%',fontSize:90,opacity:.18}} aria-hidden="true">🌿</div>
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14}}>
      {cards.map(({icon:I,label,value,detail,page:p})=><button key={label} onClick={()=>setPage(p)} style={{textAlign:'left',display:'flex',alignItems:'center',gap:14,padding:'19px 17px',borderRadius:18,border:'1px solid #e4ece5',background:'#fff',boxShadow:'0 5px 18px #234b3508',cursor:'pointer'}}>
        <span style={{width:45,height:45,flexShrink:0,display:'grid',placeItems:'center',borderRadius:15,background:'#edf5ef',color:'#4f8060'}}><I size={21}/></span>
        <span><small style={{display:'block',fontSize:12,color:'#829188'}}>{label}</small><b style={{display:'block',fontSize:27,color:'#244b38',lineHeight:1.2,margin:'3px 0'}}>{value}</b><small style={{fontSize:11,color:'#9aa79e'}}>{detail}</small></span>
      </button>)}
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:18}}>
      <div className="panel" style={{borderRadius:20,padding:23}}>
        <div className="panelhead"><div><h3>Your daily care routine</h3><p>Simple steps, organised in one place</p></div></div>
        {data.medications.length?data.medications.slice(0,4).map(m=><div className="medrow" key={m.id}><div className="medicon"><Pill/></div><div className="medinfo"><b>{m.name}</b><small>{m.dosage} · {m.instructions||'As prescribed'}</small></div><span className="time"><Clock size={14}/>{m.schedule_time}</span></div>):<Empty icon={Pill} title="Start with your medication routine" text="Add prescribed medicines and their schedule to keep your routine organised." button="Add medication" onClick={()=>setPage('Medications')}/>}
        <button className="textbtn" onClick={()=>setPage('Medications')} style={{marginTop:12}}>Open medication tracker <ArrowUpRight size={15}/></button>
      </div>
      <div className="panel" style={{borderRadius:20,padding:23}}>
        <div className="panelhead"><div><h3>Little moments matter</h3><p>Your wellbeing at a glance</p></div></div>
        <div className="miniwell"><span className="roundicon mint"><Activity/></span><div><b>{data.activities.reduce((s,a)=>s+a.minutes,0)} min</b><small>Activity minutes recorded</small></div></div>
        <div className="miniwell"><span className="roundicon peach"><ClipboardList/></span><div><b>{data.measurements.length} entries</b><small>Health measurements saved</small></div></div>
        <div style={{marginTop:20,padding:18,borderRadius:16,background:'#f0f6f0',border:'1px solid #e4eee5'}}>
          <b style={{display:'block',color:'#345d43',marginBottom:7}}>A gentle thought for today</b>
          <p style={{fontSize:13,lineHeight:1.7,color:'#718579',margin:0}}>You don't have to do everything at once. One small step, one kind check-in, one moment at a time — that is care, too.</p>
        </div>
        <button className="textbtn" onClick={()=>setPage('Activity')} style={{marginTop:12}}>Record an activity <ArrowUpRight size={15}/></button>
      </div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:16,alignItems:'stretch'}}>
      <div style={{borderRadius:20,overflow:'hidden',background:'#fff',border:'1px solid #e4ece5',boxShadow:'0 7px 22px #234b3508'}}>
        <img src="/eldercare-family-walk.png" alt="An older adult enjoying a peaceful walk with a loved one" style={{width:'100%',height:180,objectFit:'cover',display:'block'}}/>
        <div style={{padding:'17px 19px 20px'}}>
          <b style={{display:'block',color:'#315640',fontSize:16}}>Make room for little moments.</b>
          <p style={{margin:'7px 0 0',fontSize:13,lineHeight:1.65,color:'#7b8b80'}}>A short walk, a friendly check-in, a little fresh air — everyday wellbeing is built one moment at a time.</p>
        </div>
      </div>
      <div style={{borderRadius:20,overflow:'hidden',background:'#fff',border:'1px solid #e4ece5',boxShadow:'0 7px 22px #234b3508'}}>
        <img src="/eldercare-wellness-illustration.png" alt="Illustration representing support and wellbeing for older adults" style={{width:'100%',height:180,objectFit:'cover',display:'block',background:'#eaf1ff'}}/>
        <div style={{padding:'17px 19px 20px'}}>
          <b style={{display:'block',color:'#315640',fontSize:16}}>Care works better together.</b>
          <p style={{margin:'7px 0 0',fontSize:13,lineHeight:1.65,color:'#7b8b80'}}>Keep trusted family and caregivers connected through the updates you choose to share.</p>
        </div>
      </div>
    </section>

    <div style={{padding:'16px 19px',borderRadius:16,background:'#edf5ef',color:'#64806d',fontSize:12,lineHeight:1.7,display:'flex',gap:10,alignItems:'center'}}><ShieldCheck size={19}/> Your information is yours. Share selected updates with trusted caregivers whenever you choose. ElderCare supports everyday organisation and does not replace professional medical care.</div>
  </div>;
}

function Stat({icon:I,label,value,sub}){return <div className="stat"><span className="staticon"><I/></span><div><small>{label}</small><strong>{value}</strong><span>{sub}</span></div></div>}
function Empty({icon:I,title,text,button,onClick}){return <div className="empty"><span><I/></span><b>{title}</b><p>{text}</p>{button&&<button className="primary" onClick={onClick}><Plus size={16}/>{button}</button>}</div>}
function Medications({data,act}){const[show,setShow]=useState(false);return <><SectionHead eyebrow="MEDICATION ROUTINE" title="Your medicines" desc="Keep your prescribed medication schedule organised." action={<button className="primary" onClick={()=>setShow(!show)}><Plus size={17}/> Add medicine</button>}/>{show&&<form className="formpanel" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;let f=new FormData(form);act(async()=>{await apiPost('/medications',{name:f.get('name'),dosage:f.get('dosage'),schedule_time:f.get('time'),instructions:f.get('instructions')});setShow(false)})}}><h3>New medication</h3><div className="formgrid"><Field label="Medicine name"><input name="name" required placeholder="Medicine name"/></Field><Field label="Dosage"><input name="dosage" required placeholder="e.g. 1 tablet"/></Field><Field label="Reminder time"><input name="time" type="time" required/></Field><Field label="Instructions"><input name="instructions" placeholder="e.g. After food"/></Field></div><button className="primary">Save medication</button></form>}<div className="panel">{data.medications.length?data.medications.map(m=><div className="medrow large" key={m.id}><div className="medicon"><Pill/></div><div className="medinfo"><b>{m.name}</b><small>{m.dosage} · {m.instructions||'No additional instructions'}</small></div><span className="time"><Clock size={14}/>{m.schedule_time}</span><button className="iconbtn" title="Delete" onClick={()=>act(()=>apiDelete('/medications/'+m.id))}><Trash2 size={17}/></button><button className="softbtn" onClick={()=>act(()=>apiPost('/doses',{medication_id:m.id,status:'taken'}))}>Log taken</button><button className="softbtn" onClick={()=>act(()=>apiPost('/doses',{medication_id:m.id,status:'skipped'}))}>Log skipped</button></div>):<Empty icon={Pill} title="Your medication list is empty" text="Add medicines exactly as prescribed by your healthcare professional."/>}</div><div className="panel mt"><h3>Recent dose activity</h3>{data.doses.length?data.doses.slice(0,8).map(d=><div className="listrow" key={d.id}><span>{d.medication}</span><small>{d.scheduled_for}</small><span className={'status '+d.status}>{d.status}</span></div>):<p className="muted">Dose entries will appear here when you log them.</p>}</div></>}
let tokenGet=()=>localStorage.getItem('ec_token');
async function apiPost(p,b){
  let r=await fetch(API+p,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenGet()},
    body:JSON.stringify(b)
  });
  let d=await r.json();
  if(r.status===401){
    notifySessionExpired();
    throw Error("Your session has expired. Please log in again.");
  }
  if(!r.ok) throw Error(d.error || 'Request failed');
  return d;
}
async function apiDelete(p){
  let r=await fetch(API+p,{
    method:'DELETE',
    headers:{Authorization:'Bearer '+tokenGet()}
  });
  let d=await r.json();
  if(r.status===401){
    notifySessionExpired();
    throw Error("Your session has expired. Please log in again.");
  }
  if(!r.ok) throw Error(d.error || 'Request failed');
  return d;
}
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

function Sharing({data,act}){return <><SectionHead eyebrow="YOUR PRIVACY CONTROLS" title="Caregiver sharing" desc="Choose whether to share selected summaries with someone you trust."/><div className="notice"><ShieldCheck size={19}/> Sharing is optional. Only the scopes you select are included. You can revoke access at any time.</div><form className="formpanel" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;let f=new FormData(form);act(()=>apiPost('/permissions',{caregiver_email:f.get('email'),scopes:f.getAll('scope')}));e.currentTarget.reset()}}><h3>Invite a caregiver</h3><Field label="Caregiver account email"><input name="email" type="email" required placeholder="caregiver@example.com"/></Field><p className="muted">Select what this person can view:</p><div className="checks"><label><input type="checkbox" name="scope" value="medications"/> View medication schedule and dose log</label><label><input type="checkbox" name="scope" value="manage_medications"/> Manage medication reminders and dose logs (includes view access)</label><label><input type="checkbox" name="scope" value="activity"/> Activity entries</label><label><input type="checkbox" name="scope" value="health"/> Health measurements</label></div><button className="primary">Grant selected access</button></form><div className="panel mt"><h3>Sharing permissions</h3>{data.permissions.length?data.permissions.map(p=><div className="listrow permission" key={p.id}><div><b>{p.caregiver_email}</b><small>{p.scopes.join(' · ')}</small></div><span className={'status '+(p.active?'taken':'missed')}>{p.active?'Active':'Revoked'}</span>{p.active&&<button className="softbtn danger" onClick={()=>act(()=>apiDelete('/permissions/'+p.id))}>Revoke access</button>}</div>):<p className="muted">No caregiver permissions have been created.</p>}</div></>}


function CaregiverDashboard({ownerEmail,setOwnerEmail,summary,loading,onLookup,onClear,onCreateMedication,onUpdateMedication,onLogDose}){
  const scopes=summary?.shared_scopes || [];
  const canManage=Boolean(summary?.can_manage_medications);
  const [showAdd,setShowAdd]=useState(false);
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState('');
  async function submitNewMedication(e){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    setSaving(true);setFormError('');
    try{
      await onCreateMedication({name:f.get('name'),dosage:f.get('dosage'),schedule_time:f.get('schedule_time'),instructions:f.get('instructions')});
      e.currentTarget.reset();setShowAdd(false);
    }catch(err){setFormError(err.message||'Could not add the reminder.');}
    finally{setSaving(false);}
  }
  async function update(id,payload){
    setSaving(true);setFormError('');
    try{await onUpdateMedication(id,payload);}
    catch(err){setFormError(err.message||'Could not update the schedule.');}
    finally{setSaving(false);}
  }
  async function logDose(medication_id,status){
    setSaving(true);setFormError('');
    try{await onLogDose({medication_id,status});}
    catch(err){setFormError(err.message||'Could not record the dose.');}
    finally{setSaving(false);}
  }
  return <>
    <SectionHead eyebrow="APPROVED CAREGIVER ACCESS" title="Caregiver dashboard" desc="View shared information and, when authorised, help manage everyday medication reminders."/>
    <form className="formpanel" onSubmit={onLookup}>
      <h3>View a person’s shared summary</h3>
      <Field label="ElderCare account email"><input type="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} placeholder="elderly.person@example.com" required /></Field>
      <button className="primary" type="submit" disabled={loading}>{loading ? 'Checking access…' : 'Check access and view summary'}</button>
      {summary && <button className="softbtn" type="button" onClick={onClear}>Clear summary</button>}
    </form>
    {!summary && <div className="notice mt"><ShieldCheck size={18}/> Access is checked by ElderCare. If permission has not been granted, has been revoked, or the email is incorrect, the information will not be shown.</div>}
    {summary && <>
      <div className="panel mt"><h3>Shared by {summary.owner?.name || 'ElderCare user'}</h3><p className="muted">{summary.owner?.email}</p><p className="muted">Approved categories: {scopes.map(s=>s==='manage_medications'?'medication management':s).join(' · ')}</p></div>
      {scopes.includes('medications') && <div className="panel mt">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div><h3>Medication schedule</h3><p className="muted">{canManage?'You can manage reminders for this person. Prescribed dosage is read-only.':'View-only medication access.'}</p></div>
          {canManage&&<button className="primary" type="button" onClick={()=>setShowAdd(v=>!v)}><Plus size={16}/> Add reminder</button>}
        </div>
        {showAdd&&canManage&&<form className="formpanel" onSubmit={submitNewMedication}>
          <h3>Add a prescribed medicine reminder</h3>
          <p className="muted">Enter the medicine and dosage exactly as written on the current prescription. This records the prescription information and sets a reminder; it does not prescribe or change treatment.</p>
          <div className="formgrid">
            <Field label="Medicine name"><input name="name" required maxLength="120" placeholder="Medicine name"/></Field>
            <Field label="Prescribed dosage (record as written)"><input name="dosage" required maxLength="80" placeholder="e.g. 1 tablet"/></Field>
            <Field label="Reminder time"><input name="schedule_time" type="time" required/></Field>
            <Field label="Instructions"><input name="instructions" maxLength="250" placeholder="e.g. After food, as prescribed"/></Field>
          </div>
          <button className="primary" disabled={saving}>{saving?'Saving…':'Save reminder'}</button>
          {formError&&<p className="error">{formError}</p>}
        </form>}
        {summary.medications?.length ? summary.medications.map((m,i)=><div className="listrow" key={m.id||i} style={{alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div style={{minWidth:140,flex:'1 1 160px'}}><b>{m.name}</b><small>{m.dosage} · {m.instructions||'As prescribed'}</small></div>
          <span className={'status '+(m.active?'taken':'missed')}>{m.active?'Active':'Paused'}</span><span className="status taken">{m.schedule_time}</span>
          {canManage&&<div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            <button className="softbtn" type="button" disabled={saving||!m.active} onClick={()=>{const next=window.prompt('Enter the new reminder time (24-hour HH:MM):',m.schedule_time);if(next!==null&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(next))update(m.id,{schedule_time:next});else if(next!==null)window.alert('Please enter a valid time, for example 08:30.')}}>Change time</button>
            <button className="softbtn" type="button" disabled={saving} onClick={()=>update(m.id,{active:!m.active})}>{m.active?'Pause reminder':'Resume reminder'}</button>
            <button className="softbtn" type="button" disabled={saving||!m.active} onClick={()=>logDose(m.id,'taken')}>Mark taken</button>
            <button className="softbtn" type="button" disabled={saving||!m.active} onClick={()=>logDose(m.id,'missed')}>Mark missed</button>
          </div>}
        </div>):<p className="muted">No medication reminders have been shared.</p>}
        {formError&&<p className="error">{formError}</p>}
        <h3 className="mt">Recent dose history</h3>
        {summary.recent_doses?.length ? summary.recent_doses.map((d,i)=><div className="listrow" key={d.id||i}><b>{d.medication}</b><small>{d.scheduled_for}</small><span className={'status '+(d.status==='taken'?'taken':'missed')}>{d.status}</span></div>):<p className="muted">No dose history has been shared.</p>}
        {canManage&&summary.care_actions?.length>0&&<><h3 className="mt">Caregiver activity log</h3>{summary.care_actions.map((a,i)=><div className="listrow" key={i}><b>{a.action.replace(/_/g,' ')}</b><small>{a.details} · {a.caregiver}</small><span className="muted">{a.created_at}</span></div>)}</>}
        {canManage&&<p className="notice mt"><ShieldCheck size={17}/> Changes are recorded. Caregivers can manage reminder times and routine logs, but cannot change a prescribed dosage. Confirm treatment changes with the prescribing healthcare professional.</p>}
      </div>}
      {scopes.includes('activity') && <div className="panel mt"><h3>Activity records</h3>{summary.activities?.length ? summary.activities.map((a,i)=><div className="listrow" key={i}><b>{a.activity}</b><small>{a.activity_date}</small><span className="status taken">{a.minutes} min</span></div>):<p className="muted">No activity entries have been shared.</p>}</div>}
      {scopes.includes('health') && <div className="panel mt"><h3>Health measurements</h3>{summary.measurements?.length ? summary.measurements.map((m,i)=><div className="listrow" key={i}><b>{String(m.kind || '').replace('_',' ')}</b><strong>{m.value} {m.unit}</strong><small>{m.recorded_at}</small></div>):<p className="muted">No health measurements have been shared.</p>}<p className="notice mt"><ShieldCheck size={17}/> These are user-recorded values, not clinical interpretation. Discuss readings with a qualified healthcare professional.</p></div>}
      <p className="notice mt"><ShieldCheck size={17}/> Access depends on the account owner’s active permission. If access is revoked, a new check will be denied.</p>
    </>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
