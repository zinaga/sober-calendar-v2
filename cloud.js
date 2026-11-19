/* Optional Supabase sync. Local app works without this file being configured. */
let cloudClient=null, cloudUser=null, cloudTimer=null, cloudBusy=false, cloudReady=false;
const cloudStatus=document.getElementById('cloudStatus');
const cloudSetStatus=(msg)=>{cloudStatus.textContent=msg};
const googleLogin=document.getElementById('googleLogin');
const cloudLogout=document.getElementById('logout');
const cloudSync=document.getElementById('syncNow');
const editReporter=document.getElementById('editReporter');
const headerIdentity=document.getElementById('headerIdentity');
const headerGuest=document.getElementById('headerGuest');
const headerReporter=document.getElementById('headerReporter');
const headerAccountEmail=document.getElementById('headerAccountEmail');
function reporterName(){return String(cloudUser?.user_metadata?.reporter_name||'').trim()}
const headerReporterEdit=document.getElementById('headerReporterEdit');
const reporterDialog=document.getElementById('reporterDialog');
const reporterForm=document.getElementById('reporterForm');
const reporterNameInput=document.getElementById('reporterNameInput');
const reporterCancel=document.getElementById('reporterCancel');
const reporterSave=document.getElementById('reporterSave');
const reporterError=document.getElementById('reporterError');
function openReporterEditor(){
 if(!cloudUser||!cloudClient){cloudSetStatus('이름을 변경하려면 먼저 로그인해 주세요.');return}
 reporterNameInput.value=reporterName();
 reporterError.hidden=true;reporterError.textContent='';
 if(!reporterDialog.open)reporterDialog.showModal();
 reporterNameInput.focus();
}
reporterCancel.onclick=()=>reporterDialog.close();
reporterDialog.addEventListener('click',e=>{if(e.target===reporterDialog)reporterDialog.close()});
reporterForm.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!cloudUser||!cloudClient)return;
 const name=reporterNameInput.value.trim();
 if(!name||name.length>40){reporterError.textContent='이름을 1~40자로 입력해 주세요.';reporterError.hidden=false;return}
 reporterSave.disabled=true;
 try{
  const {data:result,error}=await cloudClient.auth.updateUser({data:{reporter_name:name}});
  if(error)throw error;
  cloudUser=result.user||cloudUser;
  updateCloudUI();
  reporterDialog.close();
  cloudSetStatus('신고자 이름이 저장됐어요. 다른 기기에서도 같은 이름을 사용합니다.');
 }catch(err){reporterError.textContent='이름 저장 실패: '+err.message;reporterError.hidden=false}
 finally{reporterSave.disabled=false}
});
editReporter.addEventListener('click',openReporterEditor);
headerReporterEdit.addEventListener('click',openReporterEditor);

// Personal tolerance settings live in Supabase Auth user metadata, so no schema change is required.
async function saveCloudLimits(limits){
 if(!cloudClient||!cloudUser){cloudSetStatus('주량 설정이 이 기기에 저장됐어요. 로그인하면 계정에 동기화됩니다.');return}
 try{
  const {data:result,error}=await cloudClient.auth.updateUser({data:{personal_limits:limits}});
  if(error)throw error;
  cloudUser=result.user||cloudUser;
  cloudSetStatus('개인 주량 설정이 계정에 동기화됐어요.');
 }catch(err){cloudSetStatus('주량 설정 클라우드 저장 실패: '+err.message+' · 이 기기에는 저장돼 있어요.')}
}
async function saveCloudPledge(value){
 if(!cloudClient||!cloudUser){pledgeFeedback.textContent='이 브라우저에만 저장되었습니다.';return}
 try{
  const {data:result,error}=await cloudClient.auth.updateUser({data:{personal_pledge:value}});
  if(error)throw error;
  cloudUser=result.user||cloudUser;
  pledgeFeedback.textContent='계정에 저장되었습니다. 다른 기기에서도 볼 수 있어요.';
 }catch(err){pledgeFeedback.textContent='이 브라우저에는 저장됐지만 계정 동기화에 실패했습니다: '+err.message}
}
async function pullCloudPledge(){
 if(!cloudClient||!cloudUser)return;
 const {data:result,error}=await cloudClient.auth.getUser();
 if(error)throw error;
 if(!result.user||result.user.id!==cloudUser.id)return;
 cloudUser=result.user;
 const remote=cloudUser.user_metadata?.personal_pledge;
 if(typeof remote==='string'){
  personalPledge=remote;
  localStorage.setItem(PLEDGE_KEY,remote);
  renderPledge();
 }else if(personalPledge){
  await saveCloudPledge(personalPledge);
 }
}
// Monthly goals are stored in Auth user metadata, alongside personal limits and pledge.
async function saveCloudMonthlyGoals(goals){
 if(!cloudClient||!cloudUser){cloudSetStatus('월별 목표가 이 브라우저에 저장됐어요. 로그인하면 동기화됩니다.');return}
 try{
  const {data:result,error}=await cloudClient.auth.updateUser({data:{monthly_drinking_goals:goals}});
  if(error)throw error;
  cloudUser=result.user||cloudUser;
  cloudSetStatus('월별 목표가 계정에 동기화됐어요.');
 }catch(err){cloudSetStatus('월별 목표 동기화 실패: '+err.message+' · 브라우저에는 저장돼 있어요.')}
}
async function pullCloudMonthlyGoals(){
 if(!cloudClient||!cloudUser)return;
 const {data:result,error}=await cloudClient.auth.getUser();
 if(error)throw error;
 if(!result.user||result.user.id!==cloudUser.id)return;
 cloudUser=result.user;
 const remote=cloudUser.user_metadata?.monthly_drinking_goals;
 if(remote&&typeof remote==='object'&&!Array.isArray(remote)){
  // Cloud is authoritative for signed-in users; avoid leaking another account's local goals.
  const validated=Object.fromEntries(Object.entries(remote).filter(([k,v])=>/^\d{4}-\d{2}$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=31));
  window.arsMonthlyGoals?.set(validated);
 }else{
  // First login migrates existing browser goals without changing the monthly dates.
  const localGoals=window.arsMonthlyGoals?.get()||{};
  if(Object.keys(localGoals).length)await saveCloudMonthlyGoals(localGoals);
 }
}
async function pullCloudLimits(){
 if(!cloudClient||!cloudUser)return;
 const {data:result,error}=await cloudClient.auth.getUser();
 if(error)throw error;
 if(!result.user||result.user.id!==cloudUser.id)return;
 cloudUser=result.user;
 const remote=cloudUser.user_metadata?.personal_limits;
 if(remote&&typeof remote==='object'&&!Array.isArray(remote)){
  personalLimits=remote;
  localStorage.setItem(LIMIT_KEY,JSON.stringify(remote));
  renderExtraStats();
 }else{
  // Migrate existing browser settings only on first sync for this account.
  // Empty settings must not create an empty cloud record that blocks future migration.
  if(Object.keys(personalLimits||{}).length)await saveCloudLimits(personalLimits);
 }
}
function updateCloudUI(){googleLogin.hidden=!!cloudUser;cloudLogout.hidden=!cloudUser;cloudSync.hidden=!cloudUser;editReporter.hidden=!cloudUser;headerIdentity.hidden=!cloudUser;headerGuest.hidden=!!cloudUser;if(cloudUser){headerReporter.textContent=reporterName()?'신고자 · '+reporterName()+' 님':'신고자 · 이름 미등록';headerAccountEmail.textContent='계정: '+(cloudUser.email||'');editReporter.textContent=reporterName()?'✎ 신고자 이름 변경':'✎ 신고자 이름 등록'}const info=document.getElementById('cloudAccountInfo');if(info){info.hidden=!cloudUser;if(cloudUser){document.getElementById('cloudReporterName').textContent=(reporterName()||'이름 미등록')+(reporterName()?' 님':'');document.getElementById('cloudAccountAddress').textContent=cloudUser.email||'이메일 없음'}}const badge=document.getElementById('cloudConnection');if(badge)badge.hidden=!cloudUser;window.dispatchEvent(new Event('ars-cloud-user-changed'))}
function scheduleCloudSave(){if(!cloudReady||!cloudUser)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>void pushCloud(),850)}
async function pushCloud(throwOnError=false){
 if(!cloudReady||!cloudUser)return false;
 if(cloudBusy){scheduleCloudSave();return false}
 cloudBusy=true;
 try{
  const snapshot=JSON.parse(JSON.stringify(data));
  const {error}=await cloudClient.from('sober_records').upsert({user_id:cloudUser.id,days:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)throw error;
  cloudSetStatus('☁️ 동기화 완료 · '+new Date().toLocaleTimeString('ko-KR'));
  return true;
 }catch(err){
  cloudSetStatus('동기화 실패: '+err.message+' · 기기 기록은 유지됩니다. 클라우드 연결 상태를 확인해 주세요.');
  if(throwOnError)throw err;
  return false;
 }finally{cloudBusy=false}
}
function downloadCloudSnapshot(days,source){
 const blob=new Blob([JSON.stringify({app:'sober-calendar',version:1,days},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
 a.download='sober-calendar-'+source+'-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function chooseCloudConflict(local,remote,conflicts){
 const sorted=conflicts.slice().sort();
 const describe=record=>{
  if(!record)return '기록 없음';
  const status=record.status==='dry'?'금주':record.status==='drink'?'음주':record.status==='unknown'?'미기록':String(record.status||'기록');
  const sessions=(record.sessions||[]).map((session,i)=>{
   const drinks=session.drinks||session.items||[];
   const details=Array.isArray(drinks)?drinks.map(d=>[d.type||d.name||d.alcoholType||d.kind,d.amount||d.volume||d.size,d.quantity||d.count].filter(v=>v!==undefined&&v!==null&&v!=='').join(' · ')).join(' / '):'';
   return (i+1)+'차: '+(details||JSON.stringify(session));
  });
  const extra=Object.entries(record).filter(([k])=>!['status','sessions'].includes(k)).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):String(v)));
  return [status,...sessions,...extra].join('\n');
 };
 const styleButton=(button,primary=false)=>{button.type='button';button.style.cssText='padding:10px 14px;border:1px solid #cbd6e5;border-radius:9px;cursor:pointer;background:'+(primary?'#142c50':'white')+';color:'+(primary?'white':'#142c50');return button};
 const makeButton=(label,primary=false)=>styleButton(Object.assign(document.createElement('button'),{textContent:label}),primary);
 const makePanel=(wide=false)=>{
  const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:#17263caa;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px';
  const panel=document.createElement('div');panel.style.cssText='background:white;color:#142c50;border-radius:16px;padding:22px;max-width:'+(wide?'700':'480')+'px;width:100%;max-height:85vh;overflow:auto;font-family:inherit;box-sizing:border-box';
  overlay.append(panel);document.body.append(overlay);return {overlay,panel};
 };
 const chooseMode=()=>new Promise(resolve=>{
  const {overlay,panel}=makePanel();
  const title=document.createElement('h2');title.textContent='기기 · 클라우드 충돌 해결';title.style.marginTop='0';panel.append(title);
  const intro=document.createElement('p');intro.textContent='서로 다른 신고 기록 '+sorted.length+'일이 발견됐어요. 먼저 처리 방법을 선택하세요.';panel.append(intro);
  const options=[['local','기기 기록으로 일괄 적용','충돌한 날짜는 이 기기의 기록을 유지'],['remote','클라우드 기록으로 일괄 적용','충돌한 날짜는 클라우드 기록을 유지'],['later','나중에 결정','아무것도 변경하지 않고 동기화를 보류'],['individual','기록별로 직접 선택','각 날짜의 기록을 비교해서 하나씩 결정']];
  const group=document.createElement('div');group.style.cssText='display:grid;gap:9px;margin:18px 0';
  for(const [value,label,description] of options){
   const item=document.createElement('label');item.style.cssText='display:flex;align-items:flex-start;gap:10px;border:1px solid #dbe2ec;border-radius:10px;padding:12px;cursor:pointer';
   const radio=document.createElement('input');radio.type='radio';radio.name='sober-conflict-mode';radio.value=value;radio.checked=value==='later';radio.style.marginTop='4px';
   const copy=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('span');strong.textContent=label;small.textContent=description;small.style.cssText='display:block;color:#76849a;font-size:12px;margin-top:4px';copy.append(strong,small);item.append(radio,copy);group.append(item);
  }panel.append(group);
  const backup=document.createElement('div');backup.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
  for(const [label,source,kind] of [['기기 기록 백업',local,'device'],['클라우드 기록 백업',remote,'cloud']]){const btn=makeButton(label);btn.onclick=()=>downloadCloudSnapshot(source,kind);backup.append(btn)}
  panel.append(backup);
  const note=document.createElement('p');note.textContent='일괄 적용은 충돌한 날짜에만 적용됩니다. 한쪽에만 있는 기록은 유지합니다.';note.style.cssText='font-size:12px;color:#76849a';panel.append(note);
  const footer=document.createElement('div');footer.style.cssText='display:flex;justify-content:flex-end;gap:9px;margin-top:15px';const next=makeButton('계속',true);
  next.onclick=()=>{const mode=group.querySelector('input:checked').value;if((mode==='local'||mode==='remote')&&!confirm('충돌한 '+sorted.length+'일에 '+(mode==='local'?'기기':'클라우드')+' 기록을 일괄 적용하고 동기화할까요? 반대쪽의 충돌 기록을 덮어씁니다.'))return;overlay.remove();resolve(mode)};
  footer.append(next);panel.append(footer);
 });
 const chooseIndividual=()=>new Promise(resolve=>{
  const {overlay,panel}=makePanel(true);
  const title=document.createElement('h2');title.textContent='기기 · 클라우드 기록 비교';title.style.marginTop='0';panel.append(title);
  const intro=document.createElement('p');intro.textContent='서로 다른 날짜만 표시해요. 각 날짜에서 유지할 기록을 선택하세요. 나중에 결정하면 아무 기록도 변경하지 않아요.';panel.append(intro);
  const selections={};
  for(const date of sorted){
   const section=document.createElement('section');section.style.cssText='border-top:1px solid #ddd;padding:14px 0';
   const h=document.createElement('h3');h.textContent=date;section.append(h);
   const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:13px';
   for(const [label,record] of [['이 기기',local[date]],['클라우드',remote[date]]]){const cell=document.createElement('div');cell.style.cssText='background:#f5f7fb;padding:10px;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere';const heading=document.createElement('strong');heading.textContent=label;const body=document.createElement('div');body.style.marginTop='8px';body.textContent=describe(record);cell.append(heading,body);grid.append(cell)}
   section.append(grid);const select=document.createElement('select');select.style.cssText='margin-top:10px;padding:9px;border:1px solid #cbd6e5;border-radius:8px;width:100%;background:white;color:#142c50';
   for(const [value,label] of [['local','이 기기 기록 유지'],['remote','클라우드 기록 유지']]){const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.append(opt)}
   selections[date]=select;section.append(select);panel.append(section);
  }
  const footer=document.createElement('div');footer.style.cssText='display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;position:sticky;bottom:0;background:white;padding-top:12px';
  for(const [label,action] of [['← 뒤로','back'],['나중에 결정','later'],['선택한 내용으로 동기화','save']]){const btn=makeButton(label,action==='save');btn.onclick=()=>{overlay.remove();resolve(action==='back'?'back':action==='later'?null:Object.fromEntries(Object.entries(selections).map(([date,select])=>[date,select.value])))};footer.append(btn)}
  panel.append(footer);
 });
 return (async()=>{while(true){const mode=await chooseMode();if(mode==='later')return null;if(mode==='local'||mode==='remote')return Object.fromEntries(sorted.map(date=>[date,mode]));const choices=await chooseIndividual();if(choices==='back')continue;return choices}})();
}
function sameCloudRecord(a,b){
 // JSON object property order is not meaningful for a saved drinking record.
 const normalize=v=>{
  if(Array.isArray(v))return v.map(normalize);
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));
  return v;
 };
 return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
let cloudPullInFlight=null;
function pullCloud(){
 if(cloudPullInFlight)return cloudPullInFlight;
 const task=pullCloudOnce();
 cloudPullInFlight=task;
 void task.finally(()=>{if(cloudPullInFlight===task)cloudPullInFlight=null});
 return task;
}
async function pullCloudOnce(){if(!cloudUser)return;cloudReady=false;cloudSetStatus('클라우드 기록을 확인하고 있어요…');try{
 const {data:record,error}=await cloudClient.from('sober_records').select('days').eq('user_id',cloudUser.id).maybeSingle();
 if(error)throw error;
 const remote=record?.days||{};
 const local=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
 // Merge by date rather than asking users to overwrite an entire device.
 // When both sources contain different records for one date, preserve the cloud
 // version and keep a local recovery copy before merging.
 const different=Object.keys(local).filter(k=>Object.prototype.hasOwnProperty.call(remote,k)&&!sameCloudRecord(local[k],remote[k]));
 const conflicts=[];
 const automatic={};
 for(const k of different){
  const lt=Date.parse(local[k]?._syncModifiedAt||''),rt=Date.parse(remote[k]?._syncModifiedAt||'');
  if(Number.isFinite(lt)&&Number.isFinite(rt)&&lt!==rt)automatic[k]=lt>rt?'local':'remote';
  else conflicts.push(k);
 }
 let priority='remote';
 if(conflicts.length){
  const backupKey='sober-calendar-recovery-'+cloudUser.id+'-'+Date.now();
  localStorage.setItem(backupKey,JSON.stringify(local));
  priority=await chooseCloudConflict(local,remote,conflicts);
  if(!priority){cloudSetStatus('기록 충돌 '+conflicts.length+'일 · 선택 전까지 동기화가 일시 중지됐어요. 다시 동기화 버튼을 눌러 결정할 수 있어요.');return}
 }
 data={...local,...remote};for(const [date,source] of Object.entries(automatic))data[date]=source==='local'?local[date]:remote[date];if(conflicts.length)for(const date of conflicts)data[date]=priority[date]==='local'?local[date]:remote[date];
 if(typeof arsSavedSnapshot!=='undefined')arsSavedSnapshot=JSON.stringify(data);
 localStorage.setItem(KEY,JSON.stringify(data));
 render();
 cloudReady=true;
 // A conflict is resolved only when the chosen merged snapshot is actually
 // written to the cloud. Do not silently report success on an upsert failure.
 if(conflicts.length||Object.keys(automatic).length){
  const saved=await pushCloud(true);
  if(!saved)throw new Error('클라우드 저장이 아직 진행 중입니다. 잠시 후 다시 동기화해 주세요.');
  const {data:verified,error:verifyError}=await cloudClient.from('sober_records').select('days').eq('user_id',cloudUser.id).maybeSingle();
  if(verifyError)throw verifyError;
  if(!sameCloudRecord(verified?.days||{},data))throw new Error('클라우드에 선택한 기록이 반영되지 않았습니다. 다른 기기의 동기화 상태를 확인해 주세요.');
 }else await pushCloud();
 await pullCloudLimits();await pullCloudPledge();await pullCloudMonthlyGoals();
 }catch(err){cloudSetStatus('클라우드 동기화 확인 필요: '+err.message+' · 기기 기록은 유지됩니다.');cloudReady=false}}
function hideSignedOutRecords(){if(cloudUser)return;data={};if(typeof render==='function')render()}
async function setupCloud(){
 if(!window.SOBER_SUPABASE_URL||!window.SOBER_SUPABASE_PUBLISHABLE_KEY){cloudSetStatus('클라우드 미설정 · 현재 브라우저에만 저장 중 (config.js 설정 필요)');return}
 if(!window.supabase){cloudSetStatus('Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');return}
 cloudClient=window.supabase.createClient(window.SOBER_SUPABASE_URL,window.SOBER_SUPABASE_PUBLISHABLE_KEY);
 cloudClient.auth.onAuthStateChange((_event,session)=>{const old=cloudUser?.id;cloudUser=session?.user||null;updateCloudUI();if(cloudUser&&old!==cloudUser.id)setTimeout(()=>void pullCloud(),0);if(!cloudUser){cloudReady=false;if(old){clearSignedOutDeviceData()}hideSignedOutRecords();cloudSetStatus('로그아웃됨 · 로그인하면 기록을 불러옵니다')}});
 const {data:sessionInfo}=await cloudClient.auth.getSession();if(sessionInfo.session){cloudUser=sessionInfo.session.user;updateCloudUI();await pullCloud()}else{cloudSetStatus('Google로 로그인하면 클라우드 동기화가 시작돼요.');hideSignedOutRecords()}
}
googleLogin.onclick=async()=>{
 if(!cloudClient){cloudSetStatus('클라우드 연결을 확인해 주세요.');return}
 googleLogin.disabled=true;
 cloudSetStatus('Google 로그인 페이지로 이동 중…');
 try{
  const {error}=await cloudClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(error)throw error;
 }catch(e){cloudSetStatus('Google 로그인 오류: '+e.message);googleLogin.disabled=false}
};
// Only clear local personal data after a verified cloud save and successful sign-out.
function clearSignedOutDeviceData(){
 clearTimeout(cloudTimer);
 // Use literal storage keys: GOAL_KEY and VOLUME_KEY are scoped inside index.html.
 for(const key of ['sober-calendar-v1','sober-personal-limits-v1','sober-personal-pledge-v1','ars-v2-monthly-drinking-goals','ars-v2-volume-unit']){
  localStorage.removeItem(key);
 }
}
cloudLogout.onclick=async()=>{
 if(!cloudClient||!cloudUser)return;
 cloudLogout.disabled=true;
 let syncError=null;
 try{
  clearTimeout(cloudTimer);
  if(cloudPullInFlight)await cloudPullInFlight;
  while(cloudBusy)await new Promise(resolve=>setTimeout(resolve,100));
  if(!cloudReady)throw new Error('클라우드 동기화가 완료되지 않았어요.');
  await pushCloud(true);
  const snapshot=JSON.parse(JSON.stringify(data));
  const {data:verified,error}=await cloudClient.from('sober_records').select('days').eq('user_id',cloudUser.id).maybeSingle();
  if(error)throw error;
  if(!sameCloudRecord(verified?.days||{},snapshot))throw new Error('클라우드 저장 내용이 일치하지 않아요.');
 }catch(err){syncError=err}
 if(syncError&&!confirm('클라우드 동기화를 확인하지 못했어요: '+syncError.message+'\\n\\n계속 로그아웃하면 이 기기의 기록이 삭제될 수 있어요. 기록 내보내기로 백업한 뒤 다시 시도하는 것을 권장해요. 그래도 로그아웃할까요?')){
  cloudSetStatus('로그아웃 취소 · 기기 기록은 유지됩니다.');cloudLogout.disabled=false;return;
 }
 try{
  const {error}=await cloudClient.auth.signOut();
  if(error)throw error;
  clearSignedOutDeviceData();
  location.reload();
 }catch(err){
  cloudSetStatus('로그아웃 실패: '+err.message);
  cloudLogout.disabled=false;
 }
};
cloudSync.onclick=async()=>{if(cloudUser&&!cloudBusy)await pullCloud()};
void setupCloud();
