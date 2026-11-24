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
const nav=[['Dashboard',LayoutDashboard],['Medications',Pill],['Activity',Activity],['Health records',ClipboardList],['Caregiver sharing',Users],['Caregiver dashboard',Users]];
if(!token)return <Auth onSubmit={submitAuth} busy={busy} msg={msg}/>;
return <div className="app"><style>{`
:root{
  --ec-bg:#ead8d6;
  --ec-surface:#f7e9e5;
  --ec-surface-2:#f1deda;
  --ec-pink:#c77f83;
  --ec-pink-deep:#a95f69;
  --ec-peach:#e8b7a8;
  --ec-sage:#547764;
  --ec-ink:#3f3435;
  --ec-muted:#8a7777;
  --ec-border:#e4c9c5;
}
html,body,#root{min-height:100%;background:var(--ec-bg)!important}
body{color:var(--ec-ink)!important}
.app{background:linear-gradient(135deg,#ead8d6 0%,#e5d5d1 48%,#dce2d7 100%)!important;color:var(--ec-ink)!important}
.side{background:linear-gradient(180deg,#f4e5e1 0%,#eedbd7 100%)!important;border-right:1px solid var(--ec-border)!important}
.main{background:transparent!important}
.main header{background:rgba(247,233,229,.88)!important;border-bottom:1px solid var(--ec-border)!important;backdrop-filter:blur(12px)}
.brand,.brand small,.navlabel,.eyebrow{color:var(--ec-sage)!important}
.brandicon{background:#e7c5bf!important;color:var(--ec-pink-deep)!important}
.nav{color:#6f6262!important;border-radius:13px!important}
.nav:hover,.nav.active{background:#e7c4c1!important;color:#884e58!important}
.nav.active{box-shadow:inset 3px 0 0 var(--ec-pink-deep)!important}
.privacy,.notice{background:#ead9d4!important;border:1px solid #dfc1bb!important;color:#725f60!important;border-radius:16px!important}
.panel,.formpanel,.stat,.listrow,.empty,.profile,.sectionhead,.main .panel{background:#f7e9e5!important;border:1px solid var(--ec-border)!important;box-shadow:0 8px 24px rgba(105,67,67,.07)!important}
.panelhead h3,.panel h3,.sectionhead h2{color:#594346!important}
.panelhead p,.muted,.panel p{color:var(--ec-muted)!important}
.field input,.field select,.field textarea,input,select,textarea{background:#fbf1ed!important;border:1px solid #dfc2bd!important;color:#493b3d!important;border-radius:12px}
.field input:focus,.field select:focus,.field textarea:focus,input:focus,select:focus,textarea:focus{outline:2px solid #d69a98!important;border-color:#c77f83!important}
.primary{background:linear-gradient(135deg,#b96f78,#cf8e85)!important;color:#fff!important;border:0!important;box-shadow:0 7px 18px rgba(169,95,105,.2)!important}
.primary:hover{filter:brightness(1.04)}
.softbtn,.iconbtn{background:#ecd2cd!important;color:#925a61!important;border:1px solid #dfbdb8!important}
.textbtn{color:#a65f69!important}
.medrow,.listrow,.miniwell{background:#f3e2de!important;border-color:#e4c9c5!important}
.medicon,.roundicon,.staticon{background:#e9c9c3!important;color:#995d65!important}
.time,.status.taken{background:#e0e8dc!important;color:#55745f!important}
.error{background:#f8dedd!important;color:#934c52!important;border:1px solid #e9bdb9!important}
.toast{background:#f7e9e5!important;color:#594346!important;border:1px solid var(--ec-border)!important}
.main .panel button:not(.primary){color:#a65f69}
.main .panel img{filter:saturate(.9)}
/* Warm the few inline white surfaces while retaining contrast */
.main .panel [style*="background: rgb(255, 255, 255)"],
.main section [style*="background: rgb(255, 255, 255)"]{background:#f7e9e5!important}
@media(max-width:760px){.side{box-shadow:12px 0 35px rgba(80,50,50,.16)!important}}
`}</style><aside className={mobile?'side open':'side'}><div className="brand"><span className="brandicon"><Heart/></span><span>ElderCare<small>WELLNESS COMPANION</small></span><button className="mobileclose" onClick={()=>setMobile(false)}><X/></button></div><div className="navlabel">YOUR SPACE</div>{nav.map(([n,I])=><button key={n} className={'nav '+(page===n?'active':'')} onClick={()=>{setPage(n);setMobile(false)}}><I size={19}/>{n}</button>)}<div className="sidebottom"><div className="privacy"><ShieldCheck/><div><b>Your data, your choice</b><small>Caregiver sharing is optional and controlled by you.</small></div></div><button className="nav" onClick={logout}><LogOut size={18}/>Sign out</button></div></aside><main className="main"><header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div><div className="eyebrow">YOUR PERSONAL WELLNESS SPACE</div><h1>{page==='Dashboard'?'Good day':page}, {user?.name?.split(' ')[0]||'there'} <span className="wave">☀</span></h1></div><div className="profile"><span className="avatar">{user?.name?.[0]?.toUpperCase()}</span><div><b>{user?.name}</b><small>Personal account</small></div></div></header>{msg&&<div className="toast" onClick={()=>setMsg('')}>{msg} <X size={14}/></div>}
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
{page==='Caregiver dashboard'&&<CaregiverDashboard ownerEmail={caregiverOwnerEmail} setOwnerEmail={setCaregiverOwnerEmail} summary={caregiverSummary} loading={caregiverLoading} onLookup={loadCaregiverSummary} onClear={()=>setCaregiverSummary(null)}/>}
<footer><span>Made with care for everyday independence.</span><span>Demo MVP · Not a medical device</span></footer></main></div>}
function Auth({onSubmit,busy,msg}){
  const[mode,setMode]=useState('register');
  const isRegister=mode==='register';
  const pageStyle={minHeight:'100vh',background:'linear-gradient(135deg,#dce9df 0%,#e5e7d9 52%,#d2e2d8 100%)',padding:'clamp(18px,4vw,54px)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'};
  const shellStyle={width:'min(1180px,100%)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,390px),1fr))',background:'#f7e9e5',borderRadius:30,overflow:'hidden',boxShadow:'0 28px 90px rgba(38,75,57,.13)',border:'1px solid #e4eee6'};
  return <div style={pageStyle}><style>{`
:root{
  --ec-bg:#ead8d6;
  --ec-surface:#f7e9e5;
  --ec-surface-2:#f1deda;
  --ec-pink:#c77f83;
  --ec-pink-deep:#a95f69;
  --ec-peach:#e8b7a8;
  --ec-sage:#547764;
  --ec-ink:#3f3435;
  --ec-muted:#8a7777;
  --ec-border:#e4c9c5;
}
html,body,#root{min-height:100%;background:var(--ec-bg)!important}
body{color:var(--ec-ink)!important}
.app{background:linear-gradient(135deg,#ead8d6 0%,#e5d5d1 48%,#dce2d7 100%)!important;color:var(--ec-ink)!important}
.side{background:linear-gradient(180deg,#f4e5e1 0%,#eedbd7 100%)!important;border-right:1px solid var(--ec-border)!important}
.main{background:transparent!important}
.main header{background:rgba(247,233,229,.88)!important;border-bottom:1px solid var(--ec-border)!important;backdrop-filter:blur(12px)}
.brand,.brand small,.navlabel,.eyebrow{color:var(--ec-sage)!important}
.brandicon{background:#e7c5bf!important;color:var(--ec-pink-deep)!important}
.nav{color:#6f6262!important;border-radius:13px!important}
.nav:hover,.nav.active{background:#e7c4c1!important;color:#884e58!important}
.nav.active{box-shadow:inset 3px 0 0 var(--ec-pink-deep)!important}
.privacy,.notice{background:#ead9d4!important;border:1px solid #dfc1bb!important;color:#725f60!important;border-radius:16px!important}
.panel,.formpanel,.stat,.listrow,.empty,.profile,.sectionhead,.main .panel{background:#f7e9e5!important;border:1px solid var(--ec-border)!important;box-shadow:0 8px 24px rgba(105,67,67,.07)!important}
.panelhead h3,.panel h3,.sectionhead h2{color:#594346!important}
.panelhead p,.muted,.panel p{color:var(--ec-muted)!important}
.field input,.field select,.field textarea,input,select,textarea{background:#fbf1ed!important;border:1px solid #dfc2bd!important;color:#493b3d!important;border-radius:12px}
.field input:focus,.field select:focus,.field textarea:focus,input:focus,select:focus,textarea:focus{outline:2px solid #d69a98!important;border-color:#c77f83!important}
.primary{background:linear-gradient(135deg,#b96f78,#cf8e85)!important;color:#fff!important;border:0!important;box-shadow:0 7px 18px rgba(169,95,105,.2)!important}
.primary:hover{filter:brightness(1.04)}
.softbtn,.iconbtn{background:#ecd2cd!important;color:#925a61!important;border:1px solid #dfbdb8!important}
.textbtn{color:#a65f69!important}
.medrow,.listrow,.miniwell{background:#f3e2de!important;border-color:#e4c9c5!important}
.medicon,.roundicon,.staticon{background:#e9c9c3!important;color:#995d65!important}
.time,.status.taken{background:#e0e8dc!important;color:#55745f!important}
.error{background:#f8dedd!important;color:#934c52!important;border:1px solid #e9bdb9!important}
.toast{background:#f7e9e5!important;color:#594346!important;border:1px solid var(--ec-border)!important}
.main .panel button:not(.primary){color:#a65f69}
.main .panel img{filter:saturate(.9)}
/* Warm the few inline white surfaces while retaining contrast */
.main .panel [style*="background: rgb(255, 255, 255)"],
.main section [style*="background: rgb(255, 255, 255)"]{background:#f7e9e5!important}
@media(max-width:760px){.side{box-shadow:12px 0 35px rgba(80,50,50,.16)!important}}
`}</style>
    <div style={shellStyle}>
      <section style={{padding:'clamp(28px,5vw,62px)',backgroundImage:'linear-gradient(90deg,rgba(211,229,215,.78) 0%,rgba(220,231,211,.66) 54%,rgba(214,229,216,.32) 100%),url(/eldercare-care-hands.png)',backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat',display:'flex',flexDirection:'column',justifyContent:'space-between',gap:34,minHeight:600}}>
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
    <section style={{position:'relative',overflow:'hidden',borderRadius:26,padding:'clamp(25px,4vw,42px)',backgroundImage:'linear-gradient(100deg,rgba(29,70,51,.86) 0%,rgba(44,91,64,.72) 58%,rgba(47,91,65,.38) 100%),url(/eldercare-family-walk.png)',backgroundSize:'cover',backgroundPosition:'center 42%',color:'#fff',boxShadow:'0 16px 38px #244f3a20'}}>
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

function Sharing({data,act}){return <><SectionHead eyebrow="YOUR PRIVACY CONTROLS" title="Caregiver sharing" desc="Choose whether to share selected summaries with someone you trust."/><div className="notice"><ShieldCheck size={19}/> Sharing is optional. Only the scopes you select are included. You can revoke access at any time.</div><form className="formpanel" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;let f=new FormData(form);act(()=>apiPost('/permissions',{caregiver_email:f.get('email'),scopes:f.getAll('scope')}));e.currentTarget.reset()}}><h3>Invite a caregiver</h3><Field label="Caregiver account email"><input name="email" type="email" required placeholder="caregiver@example.com"/></Field><p className="muted">Select what this person can view:</p><div className="checks"><label><input type="checkbox" name="scope" value="medications"/> Medication schedule and dose log</label><label><input type="checkbox" name="scope" value="activity"/> Activity entries</label><label><input type="checkbox" name="scope" value="health"/> Health measurements</label></div><button className="primary">Grant selected access</button></form><div className="panel mt"><h3>Sharing permissions</h3>{data.permissions.length?data.permissions.map(p=><div className="listrow permission" key={p.id}><div><b>{p.caregiver_email}</b><small>{p.scopes.join(' · ')}</small></div><span className={'status '+(p.active?'taken':'missed')}>{p.active?'Active':'Revoked'}</span>{p.active&&<button className="softbtn danger" onClick={()=>act(()=>apiDelete('/permissions/'+p.id))}>Revoke access</button>}</div>):<p className="muted">No caregiver permissions have been created.</p>}</div></>}


function CaregiverDashboard({ownerEmail,setOwnerEmail,summary,loading,onLookup,onClear}){
  const scopes=summary?.shared_scopes || [];
  return <>
    <SectionHead
      eyebrow="APPROVED CAREGIVER ACCESS"
      title="Caregiver dashboard"
      desc="Enter the email address of the ElderCare account that has shared access with you. You will only see the categories they approved."
    />
    <form className="formpanel" onSubmit={onLookup}>
      <h3>View a person’s shared summary</h3>
      <Field label="ElderCare account email">
        <input type="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} placeholder="elderly.person@example.com" required />
      </Field>
      <button className="primary" type="submit" disabled={loading}>
        {loading ? 'Checking access…' : 'Check access and view summary'}
      </button>
      {summary && <button className="softbtn" type="button" onClick={onClear}>Clear summary</button>}
    </form>

    {!summary && <div className="notice mt"><ShieldCheck size={18}/> Access is checked by ElderCare. If permission has not been granted, has been revoked, or the email is incorrect, the information will not be shown.</div>}

    {summary && <>
      <div className="panel mt">
        <h3>Shared by {summary.owner?.name || 'ElderCare user'}</h3>
        <p className="muted">{summary.owner?.email}</p>
        <p className="muted">Approved categories: {scopes.length ? scopes.join(' · ') : 'None'}</p>
      </div>

      {scopes.includes('medications') && <div className="panel mt">
        <h3>Medication schedule</h3>
        {summary.medications?.length ? summary.medications.map((m,i)=><div className="listrow" key={i}><b>{m.name}</b><small>{m.dosage}</small><span className="status taken">{m.schedule_time}</span></div>) : <p className="muted">No active medications have been shared.</p>}
        <h3 className="mt">Recent dose history</h3>
        {summary.recent_doses?.length ? summary.recent_doses.map((d,i)=><div className="listrow" key={i}><b>{d.medication}</b><small>{d.scheduled_for}</small><span className={'status '+(d.status==='taken'?'taken':'missed')}>{d.status}</span></div>) : <p className="muted">No dose history has been shared.</p>}
      </div>}

      {scopes.includes('activity') && <div className="panel mt">
        <h3>Activity records</h3>
        {summary.activities?.length ? summary.activities.map((a,i)=><div className="listrow" key={i}><b>{a.activity}</b><small>{a.activity_date}</small><span className="status taken">{a.minutes} min</span></div>) : <p className="muted">No activity entries have been shared.</p>}
      </div>}

      {scopes.includes('health') && <div className="panel mt">
        <h3>Health measurements</h3>
        {summary.measurements?.length ? summary.measurements.map((m,i)=><div className="listrow" key={i}><b>{String(m.kind || '').replace('_',' ')}</b><strong>{m.value} {m.unit}</strong><small>{m.recorded_at}</small></div>) : <p className="muted">No health measurements have been shared.</p>}
        <p className="notice mt"><ShieldCheck size={17}/> These are user-recorded values, not clinical interpretation. Discuss readings with a qualified healthcare professional.</p>
      </div>}
      <p className="notice mt"><ShieldCheck size={17}/> Access depends on the account owner’s active permission. If access is revoked, a new check will be denied.</p>
    </>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
