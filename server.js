const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data.json');
const day = 86400000;
const iso = (d = new Date()) => new Date(d).toISOString();
const date = (d = new Date()) => new Date(d).toISOString().slice(0,10);
const plus = (n) => date(Date.now() + n * day);
const id = (p) => `${p}_${crypto.randomBytes(4).toString('hex')}`;

const seed = {
  tenants: [{ id:'t_ironpeak', slug:'ironpeak', name:'IronPeak Fitness', city:'Indiranagar, Bengaluru', accent:'#c7ff36', tagline:'Build strength. Own your peak.', rating:'4.9', tier:'Growth', logo:'IP' }],
  users: [{id:'u_owner',tenantId:'t_ironpeak',name:'Aarav Mehta',email:'owner@ironpeak.test',role:'Super Admin'}],
  plans: [
    {id:'pl_transform',tenantId:'t_ironpeak',name:'Transform',duration:30,price:1999,joiningFee:199,tax:18,perks:['Unlimited gym access','2 body composition scans','Trainer onboarding'],popular:false,value:false,active:true},
    {id:'pl_strong',tenantId:'t_ironpeak',name:'Strong 90',duration:90,price:4999,joiningFee:0,tax:18,perks:['Unlimited gym access','4 coached group sessions','Nutrition starter plan'],popular:true,value:false,active:true},
    {id:'pl_peak',tenantId:'t_ironpeak',name:'Peak Annual',duration:365,price:14999,joiningFee:0,tax:18,perks:['Unlimited gym access','12 PT sessions','Priority batch booking','Guest passes'],popular:false,value:true,active:true}
  ],
  members: [
    {id:'IP-1042',tenantId:'t_ironpeak',name:'Kavya Nair',phone:'9876543210',email:'kavya@example.com',gender:'Female',planId:'pl_peak',plan:'Peak Annual',joined:plus(-186),expiry:plus(179),paid:14999,total:17699,status:'Active',batch:'Strength 6AM',trainer:'Rohan Shah',attendance:42},
    {id:'IP-1041',tenantId:'t_ironpeak',name:'Rahul Menon',phone:'9876543211',email:'rahul@example.com',gender:'Male',planId:'pl_strong',plan:'Strong 90',joined:plus(-74),expiry:plus(16),paid:4999,total:5899,status:'Expiring Soon',batch:'HIIT 7PM',trainer:'Maya Joseph',attendance:18},
    {id:'IP-1040',tenantId:'t_ironpeak',name:'Sana Kapoor',phone:'9876543212',email:'sana@example.com',gender:'Female',planId:'pl_transform',plan:'Transform',joined:plus(-42),expiry:plus(-12),paid:1000,total:2597,status:'Payment Due',batch:'Yoga 6PM',trainer:'Isha Rao',attendance:7}
  ],
  payments: [{id:'pay_009',tenantId:'t_ironpeak',memberId:'IP-1042',member:'Kavya Nair',amount:14999,method:'UPI',status:'Paid',date:plus(-186)},{id:'pay_010',tenantId:'t_ironpeak',memberId:'IP-1041',member:'Rahul Menon',amount:4999,method:'Card',status:'Paid',date:plus(-74)}],
  invoices: [{id:'INV-2026-009',tenantId:'t_ironpeak',memberId:'IP-1042',member:'Kavya Nair',planId:'pl_peak',amount:17699,paid:14999,status:'Partially paid',due:plus(1)}],
  attendance: [], expenses:[{id:'ex_1',tenantId:'t_ironpeak',category:'Utilities',amount:12400,date:date(),note:'Electricity & water'}],
  leads:[{id:'ld_1',tenantId:'t_ironpeak',name:'Nikhil Jain',source:'Instagram',status:'Follow-up today',owner:'Priya',date:date()}],
  audit: []
};
function load(){ try{return JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{return seed} }
function save(d){ fs.writeFileSync(DATA, JSON.stringify(d,null,2)); }
function tenant(d,slug){ return d.tenants.find(t=>t.slug===slug); }
function scoped(d,k,tid){ return (d[k]||[]).filter(x=>x.tenantId===tid); }
function memberStatus(m){ if(m.paid<m.total) return 'Payment Due'; const diff=(new Date(m.expiry)-new Date())/day; return diff<0?'Expired':diff<=21?'Expiring Soon':'Active'; }
function audit(d,tid,action,before,after){ d.audit.unshift({id:id('aud'),tenantId:tid,actor:'Aarav Mehta',action,before,after,at:iso()}); }
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',x=>b+=x);req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}})})}
function publicFile(req,res){ let f=req.url==='/'?'/index.html':req.url.split('?')[0]; if(f.includes('..')) return send(res,403,{error:'Forbidden'}); let file=path.join(ROOT,'public',f); fs.readFile(file,(e,data)=>{if(e && !path.extname(f)){ file=path.join(ROOT,'public','index.html'); return fs.readFile(file,(err,html)=>{if(err)return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':'text/html'});res.end(html)}) } if(e)return send(res,404,{error:'Not found'}); const type=f.endsWith('.css')?'text/css':f.endsWith('.js')?'application/javascript':'text/html';res.writeHead(200,{'Content-Type':type});res.end(data);});}
const server=http.createServer(async(req,res)=>{
  if(!req.url.startsWith('/api/')) return publicFile(req,res);
  const parts=req.url.split('?')[0].split('/').filter(Boolean); const d=load();
  try {
    if(req.method==='GET'&&parts[1]==='public'&&parts[2]==='tenant'){const t=tenant(d,parts[3]); if(!t)return send(res,404,{error:'Gym not found'}); return send(res,200,{tenant:t,plans:scoped(d,'plans',t.id).filter(p=>p.active)});}
    if(req.method==='GET'&&parts[1]==='admin'&&parts[2]==='bootstrap'){const t=tenant(d,'ironpeak'); const ms=scoped(d,'members',t.id).map(m=>({...m,status:memberStatus(m)})); return send(res,200,{tenant:t,members:ms,plans:scoped(d,'plans',t.id),payments:scoped(d,'payments',t.id),invoices:scoped(d,'invoices',t.id),expenses:scoped(d,'expenses',t.id),leads:scoped(d,'leads',t.id),audit:scoped(d,'audit',t.id)});}
    const input=await body(req);
    if(req.method==='POST'&&parts[1]==='public'&&parts[2]==='join'){
      const t=tenant(d,input.slug); if(!t)return send(res,404,{error:'Gym not found'}); const p=scoped(d,'plans',t.id).find(x=>x.id===input.planId); if(!p)return send(res,400,{error:'Plan unavailable'}); if(!input.name||!/^\d{10}$/.test(input.phone)||!input.email)return send(res,400,{error:'Please complete your profile'});
      let m=scoped(d,'members',t.id).find(x=>x.phone===input.phone); const subtotal=p.price+p.joiningFee, total=Math.round(subtotal*(1+p.tax/100)); const invoice='INV-'+new Date().getFullYear()+'-'+String(d.invoices.length+1).padStart(3,'0'); const now=date();
      if(m){const before={...m};m.planId=p.id;m.plan=p.name;m.joined=now;m.expiry=plus(p.duration);m.total=total;m.paid=total;m.status='Active';audit(d,t.id,'Renewed membership',before,m)} else {m={id:'IP-'+(1043+d.members.length-3),tenantId:t.id,name:input.name,phone:input.phone,email:input.email,gender:input.gender||'Not specified',planId:p.id,plan:p.name,joined:now,expiry:plus(p.duration),paid:total,total,status:'Active',batch:'Unassigned',trainer:'Unassigned',attendance:0};d.members.push(m);audit(d,t.id,'Created member via join link',null,m)}
      const payment={id:id('pay'),tenantId:t.id,memberId:m.id,member:m.name,amount:total,method:input.method||'UPI',status:'Paid',date:now,source:'Public join link'};d.payments.unshift(payment); d.invoices.unshift({id:invoice,tenantId:t.id,memberId:m.id,member:m.name,planId:p.id,amount:total,paid:total,status:'Paid',due:now});save(d);return send(res,201,{member:m,invoice,payment,tenant:t,plan:p});
    }
    if(req.method==='POST'&&parts[1]==='admin'&&parts[2]==='checkin'){const m=d.members.find(x=>x.id===input.memberId&&x.tenantId==='t_ironpeak');if(!m)return send(res,404,{error:'Member not found'});d.attendance.push({id:id('att'),tenantId:m.tenantId,memberId:m.id,at:iso()});m.attendance=(m.attendance||0)+1;audit(d,m.tenantId,'Recorded check-in',null,{memberId:m.id});save(d);return send(res,200,{ok:true,member:m});}
    if(req.method==='POST'&&parts[1]==='admin'&&parts[2]==='plan'){const t=tenant(d,'ironpeak'); const p={id:id('pl'),tenantId:t.id,name:input.name,duration:+input.duration,price:+input.price,joiningFee:+input.joiningFee||0,tax:+input.tax||18,perks:['Gym access'],popular:false,value:false,active:true};d.plans.push(p);audit(d,t.id,'Created membership plan',null,p);save(d);return send(res,201,p)}
    return send(res,404,{error:'Route not found'});
  } catch(e){return send(res,500,{error:e.message||'Something went wrong'})}
});
if (require.main === module) server.listen(PORT,()=>console.log(`PulseGrid running on http://localhost:${PORT}`));
module.exports = { seed };
