import { useTranslation } from "react-i18next";
import type { DragEvent, PointerEvent } from "react";
import {useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {ArrowLeft,RotateCw,Trash2,Plus,Pencil} from "lucide-react";
import {useAuthStore} from "../../store/authStore";
import {button,createStorage,deleteStorage,fetchStorage,saveStorage,surface,tone,utilization,type Rack,type Warehouse} from "./storage.shared";

export default function StorageLayoutDesignerPage(){
 const {t}=useTranslation();
 const navigate=useNavigate();
 const canEdit=useAuthStore(s=>s.hasPermission("warehouse","edit"));
 const [data,setData]=useState<Warehouse|null>(null);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [formName,setFormName]=useState("");
 const [formLevels,setFormLevels]=useState(4);
 const [editing,setEditing]=useState(false);
 const canvas=useRef<HTMLDivElement>(null);
 const drag=useRef<{number:number;dx:number;dy:number}|null>(null);
 useEffect(()=>{fetchStorage().then(setData).catch(e=>setError(String(e)))},[]);
 const racks=data?.racks??[];
 const current=racks.find(r=>r.number===selected);
 const change=(number:number,props:Partial<Rack>)=>setData(old=>old?{...old,racks:old.racks.map(r=>r.number===number?{...r,...props}:r)}:null);
 const persist=async(number:number,props:Partial<Rack>)=>{
  setBusy(true);try{setData(await saveStorage({number,...props}));setError("");}catch(e){setError(String(e));}finally{setBusy(false)}
 };
 const create=async()=>{
  if(!formName.trim()||busy)return;
  setBusy(true);try{const updated=await createStorage(formName.trim(),formLevels);setData(updated);setSelected(updated.racks.find(r=>r.name===formName.trim())?.number??null);setFormName("");setError("");}catch(e){setError(String(e))}finally{setBusy(false)}
 };
 const edit=async()=>{
  if(!current||!formName.trim()||busy)return;
  setBusy(true);try{const updated=await saveStorage({number:current.number,name:formName.trim(),level_count:formLevels});setData(updated);setEditing(false);setError("");}catch(e){setError(String(e))}finally{setBusy(false)}
 };
 const remove=async()=>{
  if(!current||busy||!window.confirm(t("warehouse.designer.confirmDeleteLocation",{name:current.name})))return;
  setBusy(true);try{setData(await deleteStorage(current.number));setSelected(null);setEditing(false);setError("");}catch(e){setError(String(e))}finally{setBusy(false)}
 };
 const getPosition=(event:PointerEvent)=>{
  const bounds=canvas.current!.getBoundingClientRect();
  return {x:(event.clientX-bounds.left)*100/bounds.width,y:(event.clientY-bounds.top)*100/bounds.height};
 };
 const place=(event:DragEvent)=>{
  event.preventDefault();
  if(!data||!canEdit)return;
  const number=Number(event.dataTransfer.getData("text/plain"));
  const rack=racks.find(r=>r.number===number);
  if(!rack||!canvas.current)return;
  const bounds=canvas.current.getBoundingClientRect();
  const x=Math.max(0,Math.min(100-rack.width,(event.clientX-bounds.left)*100/bounds.width-rack.width/2));
  const y=Math.max(0,Math.min(100-rack.height,(event.clientY-bounds.top)*100/bounds.height-rack.height/2));
  setSelected(number);void persist(number,{x,y});
 };
 const start=(event:PointerEvent<HTMLButtonElement>,rack:Rack)=>{
  if(!canEdit||!canvas.current)return;
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
 if(!canEdit)return <p>{t("warehouse.designer.warehouseEditPermissionRequired")}</p>;
 return <div style={{display:"grid",gap:14,color:"var(--color-text-primary)"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h1 style={{margin:0,fontSize:24}}>{t("warehouse.designer.wHStorageDesigner")}</h1><p style={{color:"var(--color-text-secondary)"}}>{t("warehouse.designer.mapYourWarehouseAtAnyTimeYourLayoutIsSavedEvenWhenTheP")}</p></div><button style={button} onClick={()=>navigate("/warehouse/storage-utilization")}><ArrowLeft size={15}/> {t("warehouse.designer.back")}</button></header>
  {error&&<p role="alert" style={{color:"#dc2626"}}>{error}</p>}
  {!data&&!error&&<p>{t("warehouse.designer.loadingLayout")}</p>}
  {data&&<div style={{display:"grid",gridTemplateColumns:"minmax(180px,220px) minmax(0,1fr)",gap:14}}>
   <aside style={{...surface,maxHeight:"78vh",overflowY:"auto"}}><h2 style={{fontSize:16,marginTop:0}}>{t("warehouse.designer.rackLibrary")}</h2><p style={{fontSize:12,color:"var(--color-text-secondary)"}}>{t("warehouse.designer.dragARackToPlaceItUnplacedRacksCanBePositionedFromHere")}</p><div style={{display:"grid",gap:6,marginBottom:14}}>
    <label style={{fontSize:12}}>{t("warehouse.designer.locationName")}<input style={{...button,width:"100%",boxSizing:"border-box"}} value={formName} maxLength={80} onChange={e=>setFormName(e.target.value)}/></label>
    <label style={{fontSize:12}}>{t("warehouse.designer.levelCount")}<input style={{...button,width:"100%",boxSizing:"border-box"}} type="number" min={1} max={20} value={formLevels} onChange={e=>setFormLevels(Number(e.target.value))}/></label>
    <button type="button" style={button} disabled={busy||!formName.trim()||formLevels<1||formLevels>20} onClick={()=>void (editing?edit():create())}>{editing?<Pencil size={14}/>:<Plus size={14}/>} {editing?t("warehouse.designer.saveLocation"):t("warehouse.designer.addLocation")}</button>
    {editing&&<button type="button" style={button} onClick={()=>{setEditing(false);setFormName("");setFormLevels(4)}}>{t("warehouse.designer.cancelEdit")}</button>}
   </div><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7}}>{racks.map(r=><button key={r.number} draggable={!busy} onDragStart={e=>e.dataTransfer.setData("text/plain",String(r.number))} onClick={()=>setSelected(r.number)} style={{...button,fontWeight:600,background:selected===r.number?"var(--color-bg)":"var(--color-surface)",borderColor:selected===r.number?"var(--color-primary)":"var(--color-border)"}}>{r.name}<div style={{fontSize:10,color:"var(--color-text-secondary)"}}>{r.x===null?t("warehouse.designer.unplaced"):t("warehouse.designer.placed")}</div></button>)}</div></aside>
   <main style={{display:"grid",gap:12,minWidth:0}}><section style={surface}><h2 style={{fontSize:16,margin:"0 0 10px"}}>{t("warehouse.designer.warehouseFloorPlan")}</h2><div ref={canvas} onDrop={place} onDragOver={e=>e.preventDefault()} style={{height:"min(68vh,710px)",minHeight:440,position:"relative",overflow:"hidden",border:"1px solid var(--color-border)",borderRadius:10,background:"var(--color-bg)",backgroundImage:"linear-gradient(to right,var(--color-border) 1px,transparent 1px),linear-gradient(to bottom,var(--color-border) 1px,transparent 1px)",backgroundSize:"5% 5%"}}>
   {racks.filter(r=>r.x!==null&&r.y!==null).map(r=><button key={r.number} onPointerDown={e=>start(e,r)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onClick={()=>setSelected(r.number)} style={{position:"absolute",left:r.x+"%",top:r.y+"%",width:r.width+"%",height:r.height+"%",transform:`rotate(${r.rotation}deg)`,background:"var(--color-surface)",color:"var(--color-text-primary)",border:selected===r.number?"3px solid #2563eb":"1px solid #64748b",borderRadius:7,cursor:"grab",touchAction:"none",fontSize:10,fontWeight:700,display:"flex",flexDirection:"column",gap:2,padding:3,overflow:"hidden",minWidth:38,minHeight:55}}><strong>{r.name}</strong>{r.levels.map(l=><span key={l.level} title={`${r.name}-${String(l.level).padStart(2,"0")} · ${utilization(l).toFixed(2)}%`} style={{background:tone(utilization(l)),color:"#111827",width:"100%",flex:1,borderRadius:3,display:"grid",placeItems:"center",fontSize:9}}>{String(l.level).padStart(2,"0")} · {Math.round(utilization(l))}%</span>)}</button>)}
   {!racks.some(r=>r.x!==null)&&<div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none",color:"var(--color-text-secondary)"}}>{t("warehouse.designer.dragATJRRackFromTheLibraryToStartMapping")}</div>}
   </div></section>
   {current&&<section style={surface}><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginBottom:8}}><button style={button} disabled={busy} onClick={()=>{setEditing(true);setFormName(current.name);setFormLevels(current.levels.length)}}><Pencil size={14}/>{t("warehouse.designer.editLocation")}</button><button style={button} disabled={busy} onClick={()=>void remove()}><Trash2 size={14}/>{t("warehouse.designer.deleteLocation")}</button></div><h2 style={{fontSize:16,marginTop:0}}>{current.name} · {t("warehouse.designer.properties")}</h2><div style={{display:"flex",flexWrap:"wrap",gap:10}}>{(["x","y","width","height"] as const).map(key=><label key={key} style={{fontSize:12,display:"grid",gap:4}}>{key.toUpperCase()} (%)<input style={{width:83,padding:6,border:"1px solid var(--color-border)",background:"var(--color-bg)",color:"var(--color-text-primary)",borderRadius:6}} type="number" min={0} max={100} step={0.5} value={current[key]??""} onChange={e=>change(current.number,{[key]:e.target.value===""?null:Number(e.target.value)})} onBlur={e=>{const value=e.target.value===""?null:Number(e.target.value);if(!busy)void persist(current.number,{[key]:value});}}/></label>)}</div><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}><button style={button} onClick={()=>void persist(current.number,{rotation:(current.rotation+90)%360})}><RotateCw size={14}/> {t("warehouse.designer.rotate")}</button><button style={button} disabled={busy} onClick={()=>void persist(current.number,{x:null,y:null})}><Trash2 size={14}/> {t("warehouse.designer.unplace")}</button><span style={{fontSize:12,color:"var(--color-text-secondary)",alignSelf:"center"}}>{busy?t("warehouse.designer.saving"):t("warehouse.designer.positionSizeAndRotationSaveAutomatically")}</span></div></section>}
   </main>
  </div>}
 </div>;
}
