const crypto = require('crypto');
const { seed } = require('../../server');
const day = 86400000;
const date = (d = new Date()) => new Date(d).toISOString().slice(0,10);
const plus = (n) => date(Date.now() + n * day);
const id = (p) => `${p}_${crypto.randomBytes(4).toString('hex')}`;
let store;
const data = () => store || (store = JSON.parse(JSON.stringify(seed)));
const tenant = (d, slug) => d.tenants.find(t => t.slug === slug);
const scoped = (d, key, tenantId) => (d[key] || []).filter(x => x.tenantId === tenantId);
const memberStatus = (m) => {
  if (m.paid < m.total) return 'Payment Due';
  const remaining = (new Date(m.expiry) - new Date()) / day;
  return remaining < 0 ? 'Expired' : remaining <= 21 ? 'Expiring Soon' : 'Active';
};
const response = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const audit = (d, tenantId, action, before, after) => d.audit.unshift({ id:id('aud'), tenantId, actor:'Aarav Mehta', action, before, after, at:new Date().toISOString() });

exports.handler = async (event) => {
  try {
    const d = data();
    const raw = event.path.replace(/^\/.netlify\/functions\/api\/?/, '').replace(/^\/api\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    const input = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === 'GET' && parts[0] === 'public' && parts[1] === 'tenant') {
      const t = tenant(d, parts[2]);
      return t ? response(200, { tenant:t, plans:scoped(d,'plans',t.id).filter(p=>p.active) }) : response(404,{error:'Gym not found'});
    }
    if (event.httpMethod === 'GET' && parts[0] === 'admin' && parts[1] === 'bootstrap') {
      const t = tenant(d, 'ironpeak');
      return response(200, { tenant:t, members:scoped(d,'members',t.id).map(m=>({...m,status:memberStatus(m)})), plans:scoped(d,'plans',t.id), payments:scoped(d,'payments',t.id), invoices:scoped(d,'invoices',t.id), expenses:scoped(d,'expenses',t.id), leads:scoped(d,'leads',t.id), audit:scoped(d,'audit',t.id) });
    }
    if (event.httpMethod === 'POST' && parts[0] === 'public' && parts[1] === 'join') {
      const t = tenant(d, input.slug); const p = t && scoped(d,'plans',t.id).find(x=>x.id===input.planId);
      if (!t || !p) return response(400,{error:'Gym or plan unavailable'});
      if (!input.name || !/^\d{10}$/.test(input.phone) || !input.email) return response(400,{error:'Please complete your profile'});
      const subtotal=p.price+p.joiningFee, total=Math.round(subtotal*(1+p.tax/100)), invoice='INV-'+new Date().getFullYear()+'-'+String(d.invoices.length+1).padStart(3,'0'), now=date();
      let m=scoped(d,'members',t.id).find(x=>x.phone===input.phone);
      if(m){ const before={...m}; Object.assign(m,{planId:p.id,plan:p.name,joined:now,expiry:plus(p.duration),total,paid:total,status:'Active'}); audit(d,t.id,'Renewed membership',before,m); }
      else { m={id:'IP-'+(1043+d.members.length-3),tenantId:t.id,name:input.name,phone:input.phone,email:input.email,gender:input.gender||'Not specified',planId:p.id,plan:p.name,joined:now,expiry:plus(p.duration),paid:total,total,status:'Active',batch:'Unassigned',trainer:'Unassigned',attendance:0}; d.members.push(m); audit(d,t.id,'Created member via join link',null,m); }
      const payment={id:id('pay'),tenantId:t.id,memberId:m.id,member:m.name,amount:total,method:input.method||'UPI',status:'Paid',date:now,source:'Public join link'};
      d.payments.unshift(payment); d.invoices.unshift({id:invoice,tenantId:t.id,memberId:m.id,member:m.name,planId:p.id,amount:total,paid:total,status:'Paid',due:now});
      return response(201,{member:m,invoice,payment,tenant:t,plan:p});
    }
    if (event.httpMethod === 'POST' && parts[0] === 'admin' && parts[1] === 'checkin') {
      const m=d.members.find(x=>x.id===input.memberId&&x.tenantId==='t_ironpeak'); if(!m)return response(404,{error:'Member not found'});
      d.attendance.push({id:id('att'),tenantId:m.tenantId,memberId:m.id,at:new Date().toISOString()});m.attendance=(m.attendance||0)+1;audit(d,m.tenantId,'Recorded check-in',null,{memberId:m.id});return response(200,{ok:true,member:m});
    }
    if (event.httpMethod === 'POST' && parts[0] === 'admin' && parts[1] === 'plan') {
      const t=tenant(d,'ironpeak');const p={id:id('pl'),tenantId:t.id,name:input.name,duration:+input.duration,price:+input.price,joiningFee:+input.joiningFee||0,tax:+input.tax||18,perks:['Gym access'],popular:false,value:false,active:true};d.plans.push(p);audit(d,t.id,'Created membership plan',null,p);return response(201,p);
    }
    return response(404,{error:'Route not found'});
  } catch (e) { return response(500,{error:e.message||'Unexpected server error'}); }
};
