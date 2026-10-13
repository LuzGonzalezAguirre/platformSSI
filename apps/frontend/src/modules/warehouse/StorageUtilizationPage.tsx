import {useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {Settings2,Maximize2} from "lucide-react";
import {useAuthStore} from "../../store/authStore";
import {button,fetchStorage,locationName,rackUtilization,saveStorage,surface,tone,utilization,validMix,type Rack,type Warehouse} from "./storage.shared";

const GROUPS=[[1,13],[14,26],[27,37],[38,48],[49,55]];
export default function StorageUtilizationPage(){
 const navigate=useNavigate();
 const canEdit=useAuthStore(s=>s.hasPermission("warehouse","edit"));
 const [data,setData]=useState<Warehouse|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<number|null>(null);
 const [settings,setSettings]=useState(false);
 const [full,setFull]=useState(false);
 useEffect(()=>{fetchStorage().then(setData).catch(e=>setError(String(e)))},[]);
 const racks=data?.racks??[];
 const locations=racks.flatMap(r=>r.levels);
 const overall=locations.length?locations.reduce((sum,l)=>sum+utilization(l),0)/locations.length:0;
 const active=racks.find(r=>r.number===selected);
 const openRack=(rack:Rack)=>setSelected(rack.number);
 const update=async(level:number,field:"standard_pallets"|"euro_pallets",value:number)=>{
  if(!active||busy)return;
  const next=active.levels.map(l=>l.level===level?{...l,[field]:value}:l);
  if(next.some(l=>!validMix(l.standard_pallets,l.euro_pallets))){
   setError("La combinación supera el 100% de capacidad.");return;
  }
  setBusy(true);
  setError("");
  try{
   setData(await saveStorage({number:active.number,levels:next.map(({level,standard_pallets,euro_pallets})=>({level,standard_pallets,euro_pallets}))}));
  }catch(e){setError(String(e));}finally{setBusy(false);}
 };
 return <div style={{display:"grid",gap:16,color:"var(--color-text-primary)"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h1 style={{fontSize:24,margin:0}}>WH Storage Utilization</h1><p style={{color:"var(--color-text-secondary)",margin:"4px 0"}}>55 racks · Four locations per rack · Mixed pallets</p></div>
   <div style={{display:"flex",gap:8}}><button style={button} onClick={()=>setFull(v=>!v)}><Maximize2 size={15}/> {full?"Normal view":"Expanded view"}</button>{canEdit&&<button style={button} onClick={()=>setSettings(v=>!v)}><Settings2 size={15}/> Settings</button>}</div>
  </header>
  {error&&<p role="alert" style={{color:"#dc2626"}}>{error}</p>}
  {settings&&canEdit&&data&&<section style={surface}><label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={data.designer_enabled} onChange={async e=>{try{setData(await saveStorage({designer_enabled:e.target.checked}));setError("");}catch(err){setError(String(err))}}}/> Enable physical warehouse layout</label><p style={{color:"var(--color-text-secondary)",fontSize:13}}>When enabled, the physical layout replaces the automatic map. Arrange racks in the separate designer.</p>{data.designer_enabled&&<button style={button} onClick={()=>navigate("/warehouse/storage-layout-designer")}>Open Warehouse Designer</button>}</section>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>{[["Utilization",overall.toFixed(2)+"%"],["Racks",String(racks.length)],["Locations",String(locations.length)],["Mixed",String(locations.filter(l=>l.standard_pallets>0&&l.euro_pallets>0).length)]].map(([label,val])=><div key={label} style={surface}><span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{label}</span><div style={{fontSize:26,fontWeight:700}}>{val}</div></div>)}</div>
  {data&&data.designer_enabled&&<section style={surface}><h2 style={{fontSize:16,margin:"0 0 12px"}}>Physical warehouse layout · Four levels per rack</h2>
   <div style={{height:full?800:550,position:"relative",background:"var(--color-bg)",border:"1px solid var(--color-border)",borderRadius:9,overflow:"auto",minWidth:0}}>
    {racks.filter(r=>r.x!==null&&r.y!==null).map(r=><button key={r.number} onClick={()=>openRack(r)}
     title={`TJR${r.number} · ${rackUtilization(r).toFixed(1)}%`}
     style={{position:"absolute",left:r.x+"%",top:r.y+"%",width:r.width+"%",height:r.height+"%",transform:`rotate(${r.rotation}deg)`,border:selected===r.number?"2px solid var(--color-primary)":"1px solid var(--color-border)",borderRadius:6,background:"var(--color-surface)",color:"var(--color-text-primary)",cursor:"pointer",display:"flex",flexDirection:"column",gap:2,padding:3,overflow:"hidden",minHeight:55,minWidth:38}}>
      <strong style={{fontSize:10}}>TJR{r.number}</strong>
      {r.levels.map(l=><div key={l.level} title={`${locationName(r.number,l.level)}: ${utilization(l).toFixed(2)}%`} style={{background:tone(utilization(l)),color:"#111827",fontSize:9,fontWeight:700,borderRadius:3,flex:1,display:"flex",alignItems:"center",justifyContent:"center",minHeight:0}}>{String(l.level).padStart(2,"0")} · {Math.round(utilization(l))}%</div>)}
     </button>)}
    {!racks.some(r=>r.x!==null)&&<div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",textAlign:"center",padding:16,color:"var(--color-text-secondary)"}}>No racks positioned yet. Open Warehouse Designer from Settings to map your warehouse.</div>}
   </div>
   <p style={{fontSize:12,color:"var(--color-text-secondary)"}}>Select a rack or level to change its pallet quantities below. Unmapped racks remain available in the designer.</p>
  </section>}
  {!data&&!error&&<p>Loading locations…</p>}
  {data&&!data.designer_enabled&&<section style={surface}><h2 style={{fontSize:17,margin:"0 0 12px"}}>Automatic rack map</h2>
   <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>Green: empty · Yellow: partly occupied · Red: full. Select any rack to edit its four locations.</p>
   <div style={{display:"grid",gap:20}}>{GROUPS.map(([from,to],index)=><div key={from}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontWeight:700,fontSize:13}}><span>ZONE {index+1} · TJR{from}–TJR{to}</span><span style={{color:"var(--color-text-secondary)"}}>{to-from+1} racks</span></div>
    <div style={{display:"grid",gridTemplateColumns:`repeat(${to-from+1},minmax(${full?82:67}px,1fr))`,gap:6,overflowX:"auto",paddingBottom:6}}>
    {racks.filter(r=>r.number>=from&&r.number<=to).map(r=><button key={r.number} title={`TJR${r.number}: ${rackUtilization(r).toFixed(1)}%`} onClick={()=>openRack(r)} style={{border:selected===r.number?"2px solid var(--color-primary)":"1px solid var(--color-border)",borderRadius:8,background:"var(--color-bg)",padding:"8px 4px",cursor:"pointer",minWidth:0,color:"var(--color-text-primary)"}}>
     <strong style={{fontSize:12}}>TJR{r.number}</strong><div style={{display:"grid",gap:4,marginTop:7}}>{r.levels.map(l=><div key={l.level} style={{borderLeft:`4px solid ${tone(utilization(l))}`,background:"var(--color-surface)",borderRadius:4,padding:"5px 1px",fontSize:10}}><div>{String(l.level).padStart(2,"0")}</div><b>{Math.round(utilization(l))}%</b></div>)}</div><div style={{fontSize:11,marginTop:6,fontWeight:700}}>{Math.round(rackUtilization(r))}%</div>
    </button>)}</div></div>)}</div>
  </section>}
  {active&&<section style={surface}><h2 style={{margin:"0 0 12px",fontSize:18}}>TJR{active.number} · Location details</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>{active.levels.map(l=><div key={l.level} style={{background:"var(--color-bg)",borderRadius:9,border:"1px solid var(--color-border)",padding:12}}><strong>{locationName(active.number,l.level)}</strong><div style={{color:"var(--color-text-secondary)",fontSize:13,margin:"8px 0"}}>Utilization: {utilization(l).toFixed(2)}%</div>{(["standard_pallets","euro_pallets"] as const).map(field=><label key={field} style={{display:"grid",gap:4,fontSize:12,marginBottom:8}}>{field==="standard_pallets"?"Standard pallets (50% each)":"Euro pallets (33.33% each)"}<select disabled={!canEdit||busy} value={l[field]} onChange={e=>void update(l.level,field,Number(e.target.value))} style={{padding:7,background:"var(--color-surface)",color:"var(--color-text-primary)",border:"1px solid var(--color-border)",borderRadius:6}}>{Array.from({length:field==="standard_pallets"?3:4},(_,n)=><option key={n} value={n} disabled={!validMix(field==="standard_pallets"?n:l.standard_pallets,field==="euro_pallets"?n:l.euro_pallets)}>{n}</option>)}</select></label>)}{!validMix(l.standard_pallets,l.euro_pallets)&&<span style={{fontSize:12,color:"#dc2626"}}>Capacity exceeds 100%</span>}</div>)}</div><p style={{fontSize:12,color:"var(--color-text-secondary)"}}>{busy?"Saving changes…":"Changes are saved automatically when a quantity is selected."}</p></section>}
 </div>;
}
