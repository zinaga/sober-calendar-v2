/* Optional Supabase sync. Local app works without this file being configured. */
let cloudClient=null, cloudUser=null, cloudTimer=null, cloudBusy=false, cloudReady=false;
const cloudStatus=document.getElementById('cloudStatus');
const cloudSetStatus=(msg)=>{cloudStatus.textContent=msg};
const cloudLogin=document.getElementById('login');
const loginSent=document.getElementById('loginSent');
const cloudLogout=document.getElementById('logout');
const cloudSync=document.getElementById('syncNow');
const cloudEmail=document.getElementById('email');
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
function updateCloudUI(){cloudLogin.hidden=!!cloudUser;cloudEmail.hidden=!!cloudUser;cloudLogout.hidden=!cloudUser;cloudSync.hidden=!cloudUser;editReporter.hidden=!cloudUser;headerIdentity.hidden=!cloudUser;headerGuest.hidden=!!cloudUser;if(cloudUser){headerReporter.textContent=reporterName()?'신고자 · '+reporterName()+' 님':'신고자 · 이름 미등록';headerAccountEmail.textContent='계정: '+(cloudUser.email||'');editReporter.textContent=reporterName()?'✎ 신고자 이름 변경':'✎ 신고자 이름 등록'}const info=document.getElementById('cloudAccountInfo');if(info){info.hidden=!cloudUser;if(cloudUser){document.getElementById('cloudReporterName').textContent=(reporterName()||'이름 미등록')+(reporterName()?' 님':'');document.getElementById('cloudAccountAddress').textContent=cloudUser.email||'이메일 없음'}}const badge=document.getElementById('cloudConnection');if(badge)badge.hidden=!cloudUser}
function scheduleCloudSave(){if(!cloudReady||!cloudUser)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>void pushCloud(),850)}
async function pushCloud(){if(!cloudReady||!cloudUser)return;if(cloudBusy){scheduleCloudSave();return}cloudBusy=true;try{
 const {error}=await cloudClient.from('sober_records').upsert({user_id:cloudUser.id,days:data,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(error)throw error;cloudSetStatus('☁️ 동기화 완료 · '+new Date().toLocaleTimeString('ko-KR'));
}catch(err){cloudSetStatus('동기화 실패: '+err.message+' · 로컬 기록은 남아 있어요. JSON 백업을 권장해요.')}finally{cloudBusy=false}}
function downloadCloudSnapshot(days,source){
 const blob=new Blob([JSON.stringify({app:'sober-calendar',version:1,days},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
 a.download='sober-calendar-'+source+'-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function chooseCloudConflict(local,remote,conflicts){
 return new Promise(resolve=>{
  const dlg=document.createElement('dialog');dlg.className='sync-conflict-dialog';
  const dates=conflicts.slice().sort().map(d=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(d);return m?Number(m[1])+'월 '+Number(m[2])+'일':d});
  const dateSummary=dates.length<=8?dates.join(', '):dates.slice(0,8).join(', ')+' 외 '+(dates.length-8)+'일';
  dlg.innerHTML='<form method="dialog"><h3>서로 다른 신고 기록이 발견되었습니다</h3><p>이 기기와 클라우드에 저장된 기록 중 <strong>'+conflicts.length+'일</strong>의 내용이 서로 다릅니다.</p><p class="conflict-dates">충돌 날짜: '+dateSummary+'</p><p>어떤 기록을 남길지 선택해 주세요. <strong>충돌하지 않는 날짜의 기록은 모두 유지됩니다.</strong></p><div class="conflict-backup"><strong>선택 전 기록 백업 (선택 사항)</strong><div class="sync-conflict-actions"><button type="button" data-action="download-local">기기 기록 백업</button><button type="button" data-action="download-cloud">클라우드 기록 백업</button></div></div><p><strong>서로 다른 날짜의 기록 중 어느 쪽을 남길까요?</strong></p><div class="conflict-choice-list"><button type="button" data-action="local"><strong>이 기기의 기록을 우선 적용</strong><small>충돌하는 날짜에는 현재 기기에 저장된 내용을 남깁니다.</small></button><button type="button" data-action="remote"><strong>클라우드 기록을 우선 적용</strong><small>충돌하는 날짜에는 클라우드에 저장된 내용을 남깁니다.</small></button></div><button type="button" class="conflict-cancel" data-action="cancel">나중에 결정 — 기록을 변경하지 않고 동기화를 중단합니다.</button></form>';
  document.body.appendChild(dlg);let settled=false;
  function finish(choice){if(settled)return;settled=true;dlg.close();dlg.remove();resolve(choice)}
  dlg.addEventListener('cancel',e=>{e.preventDefault();finish(null)});
  dlg.addEventListener('click',e=>{
   const action=e.target.closest('button[data-action]')?.dataset.action;
   if(action==='download-local')downloadCloudSnapshot(local,'device');
   if(action==='download-cloud')downloadCloudSnapshot(remote,'cloud');
   if(action==='local'||action==='remote')finish(action);
   if(action==='cancel')finish(null);
  });dlg.showModal();
 });
}
async function pullCloud(){if(!cloudUser)return;cloudReady=false;cloudSetStatus('클라우드 기록을 확인하고 있어요…');try{
 const {data:record,error}=await cloudClient.from('sober_records').select('days').eq('user_id',cloudUser.id).maybeSingle();
 if(error)throw error;
 const remote=record?.days||{};
 const local=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
 // Merge by date rather than asking users to overwrite an entire device.
 // When both sources contain different records for one date, preserve the cloud
 // version and keep a local recovery copy before merging.
 const conflicts=Object.keys(local).filter(k=>Object.prototype.hasOwnProperty.call(remote,k)&&JSON.stringify(local[k])!==JSON.stringify(remote[k]));
 let priority='remote';
 if(conflicts.length){
  const backupKey='sober-calendar-recovery-'+cloudUser.id+'-'+Date.now();
  localStorage.setItem(backupKey,JSON.stringify(local));
  priority=await chooseCloudConflict(local,remote,conflicts);
  if(!priority){cloudSetStatus('기록 충돌 '+conflicts.length+'일 · 선택 전까지 동기화가 일시 중지됐어요. 다시 동기화 버튼을 눌러 결정할 수 있어요.');return}
 }
 data=priority==='local'?{...remote,...local}:{...local,...remote};
 localStorage.setItem(KEY,JSON.stringify(data));await pullCloudLimits();await pullCloudPledge();render();cloudReady=true;await pushCloud();
 }catch(err){cloudSetStatus('클라우드 불러오기 실패: '+err.message+' · 로컬 기록은 유지돼요.');cloudReady=false}}
async function setupCloud(){
 if(!window.SOBER_SUPABASE_URL||!window.SOBER_SUPABASE_PUBLISHABLE_KEY){cloudSetStatus('클라우드 미설정 · 현재 브라우저에만 저장 중 (config.js 설정 필요)');return}
 if(!window.supabase){cloudSetStatus('Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');return}
 cloudClient=window.supabase.createClient(window.SOBER_SUPABASE_URL,window.SOBER_SUPABASE_PUBLISHABLE_KEY);
 cloudClient.auth.onAuthStateChange((_event,session)=>{const old=cloudUser?.id;cloudUser=session?.user||null;updateCloudUI();if(cloudUser&&old!==cloudUser.id)setTimeout(()=>void pullCloud(),0);if(!cloudUser){cloudReady=false;cloudSetStatus('로그아웃됨 · 브라우저에만 저장 중')}});
 const {data:sessionInfo}=await cloudClient.auth.getSession();if(sessionInfo.session){cloudUser=sessionInfo.session.user;updateCloudUI();await pullCloud()}else cloudSetStatus('이메일로 로그인하면 클라우드 동기화가 시작돼요.');
}
const LOGIN_COOLDOWN_KEY='sober-login-link-cooldown-until';
let loginCooldownTimer=null,loginSending=false;
function updateLoginCooldown(){
 const remaining=Math.max(0,Math.ceil((Number(localStorage.getItem(LOGIN_COOLDOWN_KEY)||0)-Date.now())/1000));
 if(loginCooldownTimer){clearInterval(loginCooldownTimer);loginCooldownTimer=null}
 if(cloudUser){cloudLogin.disabled=false;return}
 cloudLogin.disabled=loginSending||remaining>0;
 cloudLogin.textContent=remaining>0?'다시 보내기 ('+remaining+'초)':'이메일 로그인 링크 보내기';
 if(remaining>0)loginCooldownTimer=setInterval(updateLoginCooldown,1000);
}
cloudLogin.onclick=async()=>{
 if(loginSending||Number(localStorage.getItem(LOGIN_COOLDOWN_KEY)||0)>Date.now())return;
 loginSent.hidden=true;
 const email=cloudEmail.value.trim();if(!email){alert('이메일 주소를 입력해 주세요.');return}
 loginSending=true;cloudLogin.disabled=true;cloudLogin.textContent='전송 중…';
 try{
  const {error}=await cloudClient.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
  if(error)throw error;
  localStorage.setItem(LOGIN_COOLDOWN_KEY,String(Date.now()+60000));
  cloudSetStatus('로그인 링크를 이메일로 보냈어요. 메일에서 링크를 열어 주세요.');
  loginSent.hidden=false;
 }catch(e){cloudSetStatus('로그인 오류: '+e.message)}
 finally{loginSending=false;updateLoginCooldown()}
};
updateLoginCooldown();
cloudLogout.onclick=async()=>{if(cloudClient)await cloudClient.auth.signOut()};
cloudSync.onclick=async()=>{if(cloudUser&&!cloudBusy)await pullCloud()};
void setupCloud();
