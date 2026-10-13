import type { DragEvent, PointerEvent } from "react";
import {useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {ArrowLeft,RotateCw,Trash2} from "lucide-react";
import {useAuthStore} from "../../store/authStore";
import {button,fetchStorage,locationName,rackUtilization,saveStorage,surface,tone,utilization,type Rack,type Warehouse} from "./storage.shared";

export default function StorageLayoutDesignerPage(){
 const navigate=useNavigate();
 const canEdit=useAuthStore(s=>s.hasPermission("warehouse","edit"));
 const [data,setData]=useState<Warehouse|null>(null);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const canvas=useRef<HTMLDivElement>(null);
 const drag=useRef<{number:number;dx:number;dy:number}|null>(null);
 useEffect(()=>{fetchStorage().then(setData).catch(e=>setError(String(e)))},[]);
 const racks=data?.racks??[];
 const current=racks.find(r=>r.number===selected);
 const change=(number:number,props:Partial<Rack>)=>setData(old=>old?{...old,racks:old.racks.map(r=>r.number===number?{...r,...props}:r)}:null);
 const persist=async(number:number,props:Partial<Rack>)=>{
  setBusy(true);try{setData(await saveStorage({number,...props}));setError("");}catch(e){setError(String(e));}finally{setBusy(false)}
 };
 const getPosition=(event:PointerEvent)=>{
  const bounds=canvas.current!.getBoundingClientRect();
  return {x:(event.clientX-bounds.left)*100/bounds.width,y:(event.clientY-bounds.top)*100/bounds.height};
 };
 const place=(event:DragEvent)=>{
  event.preventDefault();
  if(!data||!canEdit||!data.designer_enabled)return;
  const number=Number(event.dataTransfer.getData("text/plain"));
  const rack=racks.find(r=>r.number===number);
  if(!rack||!canvas.current)return;
  const bounds=canvas.current.getBoundingClientRect();
  const x=Math.max(0,Math.min(100-rack.width,(event.clientX-bounds.left)*100/bounds.width-rack.width/2));
  const y=Math.max(0,Math.min(100-rack.height,(event.clientY-bounds.top)*100/bounds.height-rack.height/2));
  setSelected(number);void persist(number,{x,y});
 };
 const start=(event:PointerEvent<HTMLButtonElement>,rack:Rack)=>{
  if(!canEdit||!data?.designer_enabled||!canvas.current)return;
  const pos=getPosition(event);
  drag.current={number:rack.number,dx:pos.x-(rack.x??0),dy:pos.y-(rack.y??0)};
  event.currentTarget.setPointerCapture(event.pointerId);setSelected(rack.number);
 };
 const move=(event:PointerEvent<HTMLButtonElement>)=>{
  if(!drag.current||!data||!canvas.current)return;
  const rack=racks.find(r=>r.number===drag.current!.number);
  if(!rack)return;
  const pos=getPosition(event);
  change(rack.number,{x:Math.max(0,Math.min(100-rack.width,pos.x-drag.current.dx)),y:Math.max(0,Math.min(100-rack.height,pos.y-drag.current.dy))});
 };
 const stop=(event:PointerEvent<HTMLButtonElement>)=>{
  const moving=drag.current;drag.current=null;
  if(!moving)return;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const rack=racks.find(r=>r.number===moving.number);
  if(rack)void persist(rack.number,{x:rack.x,y:rack.y});
 };
 if(!canEdit)return <p>Warehouse edit permission required.</p>;
 return <div style={{display:"grid",gap:14,color:"var(--color-text-primary)"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h1 style={{margin:0,fontSize:24}}>WH Storage Designer</h1><p style={{color:"var(--color-text-secondary)"}}>Drag rack blocks onto the canvas. Assign their TJR locations and arrange the warehouse.</p></div><button style={button} onClick={()=>navigate("/warehouse/storage-utilization")}><ArrowLeft size={15}/> Back to utilization</button></header>
  {error&&<p role="alert" style={{color:"#dc2626"}}>{error}</p>}
  {!data&&!error&&<p>Loading layout…</p>}
  {data&&!data.designer_enabled&&<section style={surface}>Designer is disabled. Enable it in WH Storage Utilization Settings.</section>}
  {data&&data.designer_enabled&&<div style={{display:"grid",gridTemplateColumns:"minmax(180px,220px) minmax(0,1fr)",gap:14}}>
   <aside style={{...surface,maxHeight:"78vh",overflowY:"auto"}}><h2 style={{fontSize:16,marginTop:0}}>Rack library</h2><p style={{fontSize:12,color:"var(--color-text-secondary)"}}>Drag a rack to place it. Unplaced racks can be positioned from here.</p><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7}}>{racks.map(r=><button key={r.number} draggable={!busy} onDragStart={e=>e.dataTransfer.setData("text/plain",String(r.number))} onClick={()=>setSelected(r.number)} style={{...button,fontWeight:600,background:selected===r.number?"var(--color-bg)":"var(--color-surface)",borderColor:selected===r.number?"var(--color-primary)":"var(--color-border)"}}>TJR{r.number}<div style={{fontSize:10,color:"var(--color-text-secondary)"}}>{r.x===null?"Unplaced":"Placed"}</div></button>)}</div></aside>
   <main style={{display:"grid",gap:12,minWidth:0}}><section style={surface}><h2 style={{fontSize:16,margin:"0 0 10px"}}>Warehouse floor plan</h2><div ref={canvas} onDrop={place} onDragOver={e=>e.preventDefault()} style={{height:"min(68vh,710px)",minHeight:440,position:"relative",overflow:"hidden",border:"1px solid var(--color-border)",borderRadius:10,background:"var(--color-bg)",backgroundImage:"linear-gradient(to right,var(--color-border) 1px,transparent 1px),linear-gradient(to bottom,var(--color-border) 1px,transparent 1px)",backgroundSize:"5% 5%"}}>
   {racks.filter(r=>r.x!==null&&r.y!==null).map(r=><button key={r.number} onPointerDown={e=>start(e,r)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onClick={()=>setSelected(r.number)} style={{position:"absolute",left:r.x+"%",top:r.y+"%",width:r.width+"%",height:r.height+"%",transform:`rotate(${r.rotation}deg)`,background:"var(--color-surface)",color:"var(--color-text-primary)",border:selected===r.number?"3px solid #2563eb":"1px solid #64748b",borderRadius:7,cursor:"grab",touchAction:"none",fontSize:10,fontWeight:700,display:"flex",flexDirection:"column",gap:2,padding:3,overflow:"hidden",minWidth:38,minHeight:55}}><strong>TJR{r.number}</strong>{r.levels.map(l=><span key={l.level} title={`${locationName(r.number,l.level)} · ${utilization(l).toFixed(2)}%`} style={{background:tone(utilization(l)),color:"#111827",width:"100%",flex:1,borderRadius:3,display:"grid",placeItems:"center",fontSize:9}}>{String(l.level).padStart(2,"0")} · {Math.round(utilization(l))}%</span>)}</button>)}
   {!racks.some(r=>r.x!==null)&&<div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none",color:"var(--color-text-secondary)"}}>Drag a TJR rack from the library to start mapping.</div>}
   </div></section>
   {current&&<section style={surface}><h2 style={{fontSize:16,marginTop:0}}>TJR{current.number} · Properties</h2><div style={{display:"flex",flexWrap:"wrap",gap:10}}>{(["x","y","width","height"] as const).map(key=><label key={key} style={{fontSize:12,display:"grid",gap:4}}>{key.toUpperCase()} (%)<input style={{width:83,padding:6,border:"1px solid var(--color-border)",background:"var(--color-bg)",color:"var(--color-text-primary)",borderRadius:6}} type="number" min={0} max={100} step={0.5} value={current[key]??""} onChange={e=>change(current.number,{[key]:e.target.value===""?null:Number(e.target.value)})} onBlur={e=>{const value=e.target.value===""?null:Number(e.target.value);if(!busy)void persist(current.number,{[key]:value});}}/></label>)}</div><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}><button style={button} onClick={()=>void persist(current.number,{rotation:(current.rotation+90)%360})}><RotateCw size={14}/> Rotate</button><button style={button} disabled={busy} onClick={()=>void persist(current.number,{x:null,y:null})}><Trash2 size={14}/> Unplace</button><span style={{fontSize:12,color:"var(--color-text-secondary)",alignSelf:"center"}}>{busy?"Saving…":"Position, size and rotation save automatically."}</span></div></section>}
   </main>
  </div>}
 </div>;
}
