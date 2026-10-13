import {useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {Settings2,Maximize2,Save} from "lucide-react";
import {useAuthStore} from "../../store/authStore";
import {button,fetchStorage,locationName,rackUtilization,saveStorage,surface,tone,utilization,validMix,type Level,type Rack,type Warehouse} from "./storage.shared";

const GROUPS=[[1,13],[14,26],[27,37],[38,48],[49,55]];
export default function StorageUtilizationPage(){
 const navigate=useNavigate();
 const canEdit=useAuthStore(s=>s.hasPermission("warehouse","edit"));
 const [data,setData]=useState<Warehouse|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<number|null>(null);
 const [draft,setDraft]=useState<Level[]|null>(null);
 const [settings,setSettings]=useState(false);
 const [full,setFull]=useState(false);
 useEffect(()=>{fetchStorage().then(setData).catch(e=>setError(String(e)))},[]);
 const racks=data?.racks??[];
 const locations=racks.flatMap(r=>r.levels);
 const overall=locations.length?locations.reduce((sum,l)=>sum+utilization(l),0)/locations.length:0;
 const active=racks.find(r=>r.number===selected);
 const openRack=(rack:Rack)=>{setSelected(rack.number);setDraft(rack.levels.map(l=>({...l})))};
 const update=(level:number,field:"standard_pallets"|"euro_pallets",value:number)=>{
  setDraft(old=>old?.map(l=>l.level===level?{...l,[field]:value}:l)??null);
 };
 const save=async()=>{
  if(!selected||!draft||draft.some(l=>!validMix(l.standard_pallets,l.euro_pallets)))return;
  setBusy(true);
  try{setData(await saveStorage({number:selected,levels:draft.map(({level,standard_pallets,euro_pallets})=>({level,standard_pallets,euro_pallets}))}));setError("");}
  catch(e){setError(String(e));}finally{setBusy(false);}
 };
 return <div style={{display:"grid",gap:16,color:"var(--color-text-primary)"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h1 style={{fontSize:24,margin:0}}>WH Storage Utilization</h1><p style={{color:"var(--color-text-secondary)",margin:"4px 0"}}>55 racks · Four locations per rack · Mixed pallets</p></div>
   <div style={{display:"flex",gap:8}}><button style={button} onClick={()=>setFull(v=>!v)}><Maximize2 size={15}/> {full?"Normal view":"Expanded view"}</button>{canEdit&&<button style={button} onClick={()=>setSettings(v=>!v)}><Settings2 size={15}/> Settings</button>}</div>
  </header>
  {error&&<p role="alert" style={{color:"#dc2626"}}>{error}</p>}
  {settings&&canEdit&&data&&<section style={surface}><label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={data.designer_enabled} onChange={async e=>{try{setData(await saveStorage({designer_enabled:e.target.checked}));setError("");}catch(err){setError(String(err))}}}/> Enable physical warehouse layout</label><p style={{color:"var(--color-text-secondary)",fontSize:13}}>The automatic map is always available. Enabling the designer allows you to create a physical map in a separate page.</p>{data.designer_enabled&&<button style={button} onClick={()=>navigate("/warehouse/storage-layout-designer")}>Open Warehouse Designer</button>}</section>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>{[["Utilization",overall.toFixed(2)+"%"],["Racks",String(racks.length)],["Locations",String(locations.length)],["Mixed",String(locations.filter(l=>l.standard_pallets>0&&l.euro_pallets>0).length)]].map(([label,val])=><div key={label} style={surface}><span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{label}</span><div style={{fontSize:26,fontWeight:700}}>{val}</div></div>)}</div>
  {data&&data.designer_enabled&&racks.some(r=>r.x!==null&&r.y!==null)&&<section style={surface}><h2 style={{fontSize:16,margin:"0 0 12px"}}>Physical layout</h2><div style={{height:full?700:360,position:"relative",background:"var(--color-bg)",border:"1px solid var(--color-border)",borderRadius:9}}>{racks.filter(r=>r.x!==null&&r.y!==null).map(r=><button key={r.number} onClick={()=>openRack(r)} style={{position:"absolute",left:r.x+"%",top:r.y+"%",width:r.width+"%",height:r.height+"%",transform:`rotate(${r.rotation}deg)`,border:"1px solid var(--color-border)",borderRadius:5,background:tone(rackUtilization(r)),color:"#111827",cursor:"pointer",fontWeight:700,fontSize:11}}>TJR{r.number}</button>)}</div></section>}
  {!data&&!error&&<p>Loading locations…</p>}
  {data&&<section style={surface}><h2 style={{fontSize:17,margin:"0 0 12px"}}>Automatic rack map</h2>
   <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>Green: empty · Yellow: partly occupied · Red: full. Select any rack to edit its four locations.</p>
   <div style={{display:"grid",gap:20}}>{GROUPS.map(([from,to],index)=><div key={from}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontWeight:700,fontSize:13}}><span>ZONE {index+1} · TJR{from}–TJR{to}</span><span style={{color:"var(--color-text-secondary)"}}>{to-from+1} racks</span></div>
    <div style={{display:"grid",gridTemplateColumns:`repeat(${to-from+1},minmax(${full?82:67}px,1fr))`,gap:6,overflowX:"auto",paddingBottom:6}}>
    {racks.filter(r=>r.number>=from&&r.number<=to).map(r=><button key={r.number} title={`TJR${r.number}: ${rackUtilization(r).toFixed(1)}%`} onClick={()=>openRack(r)} style={{border:selected===r.number?"2px solid var(--color-primary)":"1px solid var(--color-border)",borderRadius:8,background:"var(--color-bg)",padding:"8px 4px",cursor:"pointer",minWidth:0,color:"var(--color-text-primary)"}}>
     <strong style={{fontSize:12}}>TJR{r.number}</strong><div style={{display:"grid",gap:4,marginTop:7}}>{r.levels.map(l=><div key={l.level} style={{borderLeft:`4px solid ${tone(utilization(l))}`,background:"var(--color-surface)",borderRadius:4,padding:"5px 1px",fontSize:10}}><div>{String(l.level).padStart(2,"0")}</div><b>{Math.round(utilization(l))}%</b></div>)}</div><div style={{fontSize:11,marginTop:6,fontWeight:700}}>{Math.round(rackUtilization(r))}%</div>
    </button>)}</div></div>)}</div>
  </section>}
  {active&&draft&&<section style={surface}><h2 style={{margin:"0 0 12px",fontSize:18}}>TJR{active.number} · Location details</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>{draft.map(l=><div key={l.level} style={{background:"var(--color-bg)",borderRadius:9,border:"1px solid var(--color-border)",padding:12}}><strong>{locationName(active.number,l.level)}</strong><div style={{color:"var(--color-text-secondary)",fontSize:13,margin:"8px 0"}}>Utilization: {utilization(l).toFixed(2)}%</div>{(["standard_pallets","euro_pallets"] as const).map(field=><label key={field} style={{display:"grid",gap:4,fontSize:12,marginBottom:8}}>{field==="standard_pallets"?"Standard pallets (50% each)":"Euro pallets (33.33% each)"}<select disabled={!canEdit||busy} value={l[field]} onChange={e=>update(l.level,field,Number(e.target.value))} style={{padding:7,background:"var(--color-surface)",color:"var(--color-text-primary)",border:"1px solid var(--color-border)",borderRadius:6}}>{Array.from({length:field==="standard_pallets"?3:4},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>)}{!validMix(l.standard_pallets,l.euro_pallets)&&<span style={{fontSize:12,color:"#dc2626"}}>Capacity exceeds 100%</span>}</div>)}</div>{canEdit&&<button style={{...button,marginTop:12}} disabled={busy||draft.some(l=>!validMix(l.standard_pallets,l.euro_pallets))} onClick={save}><Save size={15}/> {busy?"Saving…":"Save occupancy"}</button>}</section>}
 </div>;
}
