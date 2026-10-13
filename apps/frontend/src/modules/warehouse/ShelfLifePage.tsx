import {useEffect,useMemo,useState} from "react";
import {AlertTriangle,RefreshCw,Search} from "lucide-react";
import apiClient from "../../services/api.client";

type Status="expired"|"expiring"|"ok"|"unknown";
type Item={serial_no:string;part_key:string;location:string;quantity:number;container_status:string|null;shelf_date:string|null;expired_date:string|null;days_remaining:number|null;status:Status};
type Report={as_of:string;horizon_days:number;summary:{total:number;expired:number;expiring:number;ok:number;unknown:number;expired_pct:number;at_risk:number};containers:Item[];locations:{location:string;total:number;expired:number;expiring:number;ok:number;unknown:number}[];parts:{part_key:string;total:number;expired:number;expiring:number}[]};
const colors:Record<Status,string>={expired:"#dc2626",expiring:"#d97706",ok:"#16a34a",unknown:"#64748b"};
const titles:Record<Status,string>={expired:"Expired",expiring:"Expiring soon",ok:"OK",unknown:"Unknown"};
const panel:React.CSSProperties={background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:12,padding:16,color:"var(--color-text-primary)"};
const control:React.CSSProperties={border:"1px solid var(--color-border)",borderRadius:8,background:"var(--color-surface)",color:"var(--color-text-primary)",padding:"9px 12px"};
export default function ShelfLifePage(){
 const [data,setData]=useState<Report|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [horizon,setHorizon]=useState(30);
 const [asOf,setAsOf]=useState(()=>new Date().toLocaleDateString("en-CA"));
 const [search,setSearch]=useState("");
 const [location,setLocation]=useState("");
 const [status,setStatus]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const refresh=async()=>{setLoading(true);setError("");try{const response=await apiClient.get<Report>("/warehouse/shelf-life/",{params:{horizon,as_of:asOf}});setData(response.data)}catch(e){setData(null);setError(e instanceof Error?e.message:"Unable to retrieve Plex inventory")}finally{setLoading(false)}};
 useEffect(()=>{void refresh()},[horizon,asOf]);
 const locations=useMemo(()=>Array.from(new Set(data?.containers.map(x=>x.location)??[])).sort(),[data]);
 const rows=useMemo(()=>data?.containers.filter(x=>(!location||x.location===location)&&(!status||x.status===status)&&(!search||[x.serial_no,x.part_key,x.location].some(v=>v.toLowerCase().includes(search.toLowerCase()))))??[],[data,location,status,search]);
 const metric=(label:string,value:string,sub:string,color?:string)=><div style={panel}><span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{label}</span><div style={{fontSize:27,fontWeight:750,color:color||"var(--color-text-primary)",marginTop:6}}>{value}</div><small style={{color:"var(--color-text-secondary)"}}>{sub}</small></div>;
 return <div style={{display:"grid",gap:16,color:"var(--color-text-primary)"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h1 style={{fontSize:24,margin:0}}>WH Shelf Life & Expiration</h1><p style={{color:"var(--color-text-secondary)",margin:"4px 0"}}>Plex · Active containers with shelf life · TJR warehouse locations</p></div>
   <button style={{...control,display:"inline-flex",gap:7,alignItems:"center"}} onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> {loading?"Loading…":"Refresh"}</button>
  </header>
  <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap"}}>
   <label style={{display:"grid",gap:4,fontSize:12}}>Reference date<input type="date" style={control} value={asOf} onChange={e=>setAsOf(e.target.value)}/></label>
   <label style={{display:"grid",gap:4,fontSize:12}}>Expiration window<select style={control} value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[7,15,30,60,90].map(n=><option key={n} value={n}>{n} days</option>)}</select></label>
  </div>
  {error&&<div role="alert" style={{...panel,borderColor:"#dc2626",color:"#dc2626"}}><AlertTriangle size={17}/> Plex data unavailable: {error}. The dashboard does not substitute sample data.</div>}
  {!data&&loading&&<p>Loading inventory from Plex…</p>}
  {data&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
   {metric("Expired inventory",data.summary.expired_pct.toFixed(2)+"%","Target 0%",data.summary.expired?"#dc2626":"#16a34a")}
   {metric("Active containers",String(data.summary.total),"Shelf-life controlled")}
   {metric("Expired",String(data.summary.expired),"Require action","#dc2626")}
   {metric("Expiring soon",String(data.summary.expiring),`Within ${horizon} days`,"#d97706")}
   {metric("Unknown",String(data.summary.unknown),"Missing expiration data")}
  </div>
  <section style={panel}><h2 style={{fontSize:16,margin:"0 0 12px"}}>Shelf life distribution</h2><div style={{display:"flex",height:18,borderRadius:10,overflow:"hidden",background:"var(--color-bg)"}}>{(["expired","expiring","ok","unknown"] as Status[]).map(key=>data.summary[key]>0?<div key={key} title={`${titles[key]}: ${data.summary[key]}`} style={{width:`${data.summary[key]/Math.max(data.summary.total,1)*100}%`,background:colors[key]}}/>:null)}</div><div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:12,fontSize:12}}>{(["expired","expiring","ok","unknown"] as Status[]).map(key=><span key={key}><span style={{color:colors[key]}}>●</span> {titles[key]}: {data.summary[key]}</span>)}</div></section>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:14}}>
   <section style={panel}><h2 style={{fontSize:16,marginTop:0}}>Risk by location</h2>{data.locations.filter(x=>x.expired+x.expiring>0).sort((a,b)=>(b.expired+b.expiring)-(a.expired+a.expiring)).slice(0,10).map(x=><div key={x.location} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--color-border)"}}><b>{x.location}</b><span>{x.expired} expired · {x.expiring} soon</span></div>)}{!data.locations.some(x=>x.expired+x.expiring>0)&&<p>No location has a container at risk.</p>}</section>
   <section style={panel}><h2 style={{fontSize:16,marginTop:0}}>Risk by part key</h2>{data.parts.filter(x=>x.expired+x.expiring>0).slice(0,10).map(x=><div key={x.part_key} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--color-border)"}}><b>{x.part_key}</b><span>{x.expired} expired · {x.expiring} soon</span></div>)}{!data.parts.some(x=>x.expired+x.expiring>0)&&<p>No part has a container at risk.</p>}</section>
  </div>
  <section style={panel}><h2 style={{fontSize:16,margin:"0 0 12px"}}>Container details <span style={{fontSize:12,fontWeight:400}}>({rows.length})</span></h2><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
   <label style={{display:"flex",gap:5,alignItems:"center",...control}}><Search size={16}/><input aria-label="Search container or part" placeholder="Serial / Part Key / Location" value={search} onChange={e=>setSearch(e.target.value)} style={{border:0,background:"transparent",color:"inherit",outline:0}}/></label>
   <select aria-label="Location filter" style={control} value={location} onChange={e=>setLocation(e.target.value)}><option value="">All locations</option>{locations.map(v=><option key={v} value={v}>{v}</option>)}</select>
   <select aria-label="Status filter" style={control} value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{(["expired","expiring","ok","unknown"] as Status[]).map(v=><option key={v} value={v}>{titles[v]}</option>)}</select>
  </div>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Serial No","Part Key","Location","Qty","Shelf date","Expiration","Days left","Status"].map(x=><th key={x} style={{textAlign:"left",padding:10,borderBottom:"1px solid var(--color-border)"}}>{x}</th>)}</tr></thead><tbody>{rows.map(x=><tr key={x.serial_no} onClick={()=>setExpanded(expanded===x.serial_no?null:x.serial_no)} style={{cursor:"pointer",background:expanded===x.serial_no?"var(--color-bg)":"transparent"}}><td style={{padding:10}}>{x.serial_no}</td><td>{x.part_key}</td><td>{x.location}</td><td>{x.quantity}</td><td>{x.shelf_date??"—"}</td><td>{x.expired_date??"—"}</td><td>{x.days_remaining??"—"}</td><td><b style={{color:colors[x.status]}}>{titles[x.status]}</b>{expanded===x.serial_no&&<div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Plex status: {x.container_status??"—"}</div>}</td></tr>)}</tbody></table>{rows.length===0&&<p>No matching containers.</p>}</div>
  </section></>}
 </div>
}
