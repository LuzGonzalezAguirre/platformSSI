import { useTranslation } from "react-i18next";
import {useEffect,useMemo,useState} from "react";
import {AlertTriangle,RefreshCw,Search} from "lucide-react";
import apiClient from "../../services/api.client";

type Status="expired"|"expiring"|"ok"|"unknown";
type Item={serial_no:string;part_key:string;location:string;quantity:number;container_status:string|null;shelf_date:string|null;expired_date:string|null;days_remaining:number|null;status:Status};
type Report={as_of:string;horizon_days:number;summary:{total:number;expired:number;expiring:number;ok:number;unknown:number;expired_pct:number;at_risk:number};containers:Item[];locations:{location:string;total:number;expired:number;expiring:number;ok:number;unknown:number}[];parts:{part_key:string;total:number;expired:number;expiring:number}[]};
const colors:Record<Status,string>={expired:"#dc2626",expiring:"#d97706",ok:"#16a34a",unknown:"#64748b"};

const panel:React.CSSProperties={background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:12,padding:16,color:"var(--color-text-primary)"};
const control:React.CSSProperties={border:"1px solid var(--color-border)",borderRadius:8,background:"var(--color-surface)",color:"var(--color-text-primary)",padding:"9px 12px"};
export default function ShelfLifePage(){
 const {t}=useTranslation();
 const titles:Record<Status,string>={expired:t("warehouse.shelfLife.expired"),expiring:t("warehouse.shelfLife.expiringSoon"),ok:t("warehouse.shelfLife.oK"),unknown:t("warehouse.shelfLife.unknown")};
 const [data,setData]=useState<Report|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [horizon,setHorizon]=useState(30);
 const [asOf,setAsOf]=useState(()=>new Date().toLocaleDateString("en-CA"));
 const [search,setSearch]=useState("");
 const [location,setLocation]=useState("");
 const [status,setStatus]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const refresh=async()=>{setLoading(true);setError("");try{const response=await apiClient.get<Report>("/warehouse/shelf-life/",{params:{horizon,as_of:asOf}});setData(response.data)}catch(e){setData(null);setError(e instanceof Error?e.message:t("warehouse.shelfLife.unableToRetrievePlexInventory"))}finally{setLoading(false)}};
 useEffect(()=>{void refresh()},[horizon,asOf]);
 const locations=useMemo(()=>Array.from(new Set(data?.containers.map(x=>x.location)??[])).sort(),[data]);
 const rows=useMemo(()=>data?.containers.filter(x=>(!location||x.location===location)&&(!status||x.status===status)&&(!search||[x.serial_no,x.part_key,x.location].some(v=>v.toLowerCase().includes(search.toLowerCase()))))??[],[data,location,status,search]);
 const analytics=useMemo(()=>{
  const items=data?.containers??[];
  const buckets=[
   {id:"expired",label:t("warehouse.shelfLife.bucketExpired"),min:-Infinity,max:-1,color:colors.expired},
   {id:"today7",label:t("warehouse.shelfLife.bucket7"),min:0,max:7,color:"#dc8a18"},
   {id:"day815",label:t("warehouse.shelfLife.bucket15"),min:8,max:15,color:"#e3aa36"},
   {id:"day1630",label:t("warehouse.shelfLife.bucket30"),min:16,max:30,color:"#eabf69"},
   {id:"day3160",label:t("warehouse.shelfLife.bucket60"),min:31,max:60,color:"#3b82f6"},
   {id:"day6190",label:t("warehouse.shelfLife.bucket90"),min:61,max:90,color:"#6478c8"},
   {id:"later",label:t("warehouse.shelfLife.bucketLater"),min:91,max:Infinity,color:"#16a34a"},
  ];
  const counts=buckets.map(b=>({...b,count:items.filter(x=>x.days_remaining!==null&&x.days_remaining>=b.min&&x.days_remaining<=b.max).length}));
  const risks=items.filter(x=>x.days_remaining!==null&&x.days_remaining<=30);
  const next=items.filter(x=>x.days_remaining!==null&&x.days_remaining>=0).sort((a,b)=>(a.days_remaining??0)-(b.days_remaining??0)).slice(0,5);
  const at90=items.filter(x=>x.days_remaining!==null&&x.days_remaining>=0&&x.days_remaining<=90).length;
  const areas=Array.from(new Set(items.map(x=>x.location))).map(name=>({name,items:items.filter(x=>x.location===name)})).map(x=>({name:x.name,total:x.items.length,risk:x.items.filter(y=>y.days_remaining!==null&&y.days_remaining<=30).length})).sort((a,b)=>b.risk-a.risk||b.total-a.total).slice(0,8);
  const material=Array.from(new Set(risks.map(x=>x.part_key))).map(name=>({name,count:risks.filter(x=>x.part_key===name).length})).sort((a,b)=>b.count-a.count).slice(0,8);
  const checked=items.filter(x=>x.days_remaining!==null).length;
  const held=items.filter(x=>x.container_status&&x.container_status.toLowerCase()!=="ok").length;
  return {counts,next,at90,areas,material,checked,held};
 },[data,t]);
 const chartBars=(values:{name:string;value:number;color?:string}[],empty:string)=>values.length===0||values.every(x=>x.value===0)?<p style={{color:"var(--color-text-secondary)",fontSize:13}}>{empty}</p>:<div style={{display:"grid",gap:12}}>{values.map(x=><div key={x.name} style={{display:"grid",gap:5}}><div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:12}}><span>{x.name}</span><strong>{x.value}</strong></div><div style={{height:11,background:"var(--color-bg)",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:`${100*x.value/Math.max(1,...values.map(y=>y.value))}%`,background:x.color??"#6478c8",borderRadius:6}}/></div></div>)}</div>;
 const metric=(label:string,value:string,sub:string,color?:string)=><div style={panel}><span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{label}</span><div style={{fontSize:27,fontWeight:750,color:color||"var(--color-text-primary)",marginTop:6}}>{value}</div><small style={{color:"var(--color-text-secondary)"}}>{sub}</small></div>;
 return <div style={{display:"grid",gap:16,color:"var(--color-text-primary)"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h1 style={{fontSize:24,margin:0}}>{t("warehouse.shelfLife.wHShelfLifeExpiration")}</h1><p style={{color:"var(--color-text-secondary)",margin:"4px 0"}}>{t("warehouse.shelfLife.plexActiveContainersWithShelfLifeTJRWarehouseLocations")}</p></div>
   <button style={{...control,display:"inline-flex",gap:7,alignItems:"center"}} onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> {loading?t("warehouse.shelfLife.loading"):t("warehouse.shelfLife.refresh")}</button>
  </header>
  <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap"}}>
   <label style={{display:"grid",gap:4,fontSize:12}}>{t("warehouse.shelfLife.referenceDate")}<input type="date" style={control} value={asOf} onChange={e=>setAsOf(e.target.value)}/></label>
   <label style={{display:"grid",gap:4,fontSize:12}}>{t("warehouse.shelfLife.expirationWindow")}<select style={control} value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[7,15,30,60,90].map(n=><option key={n} value={n}>{n} {t("warehouse.shelfLife.days")}</option>)}</select></label>
  </div>
  {error&&<div role="alert" style={{...panel,borderColor:"#dc2626",color:"#dc2626"}}><AlertTriangle size={17}/> {t("warehouse.shelfLife.plexError",{detail:error})}</div>}
  {!data&&loading&&<p>{t("warehouse.shelfLife.loadingInventoryFromPlex")}</p>}
  {data&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
   {metric(t("warehouse.shelfLife.expiredInventory"),data.summary.expired_pct.toFixed(2)+"%",t("warehouse.shelfLife.target0"),data.summary.expired?"#dc2626":"#16a34a")}
   {metric(t("warehouse.shelfLife.activeContainers"),String(data.summary.total),t("warehouse.shelfLife.shelfLifeControlled"))}
   {metric(t("warehouse.shelfLife.expired"),String(data.summary.expired),t("warehouse.shelfLife.requireAction"),"#dc2626")}
   {metric(t("warehouse.shelfLife.expiringSoon"),String(data.summary.expiring),t("warehouse.shelfLife.withinDays",{count:horizon}),"#d97706")}
   {metric(t("warehouse.shelfLife.unknown"),String(data.summary.unknown),t("warehouse.shelfLife.missingExpirationData"))}
  </div>
  <section style={panel}><h2 style={{fontSize:16,margin:"0 0 12px"}}>{t("warehouse.shelfLife.shelfLifeDistribution")}</h2><div style={{display:"flex",height:18,borderRadius:10,overflow:"hidden",background:"var(--color-bg)"}}>{(["expired","expiring","ok","unknown"] as Status[]).map(key=>data.summary[key]>0?<div key={key} title={`${titles[key]}: ${data.summary[key]}`} style={{width:`${data.summary[key]/Math.max(data.summary.total,1)*100}%`,background:colors[key]}}/>:null)}</div><div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:12,fontSize:12}}>{(["expired","expiring","ok","unknown"] as Status[]).map(key=><span key={key}><span style={{color:colors[key]}}>●</span> {titles[key]}: {data.summary[key]}</span>)}</div></section>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:14}}>
   <section style={panel}><h2 style={{fontSize:16,marginTop:0}}>{t("warehouse.shelfLife.riskByLocation")}</h2>{data.locations.filter(x=>x.expired+x.expiring>0).sort((a,b)=>(b.expired+b.expiring)-(a.expired+a.expiring)).slice(0,10).map(x=><div key={x.location} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--color-border)"}}><b>{x.location}</b><span>{t("warehouse.shelfLife.atRiskLabels",{expired:x.expired,expiring:x.expiring})}</span></div>)}{!data.locations.some(x=>x.expired+x.expiring>0)&&<p>{t("warehouse.shelfLife.noLocationHasAContainerAtRisk")}</p>}</section>
   <section style={panel}><h2 style={{fontSize:16,marginTop:0}}>{t("warehouse.shelfLife.riskByPartKey")}</h2>{data.parts.filter(x=>x.expired+x.expiring>0).slice(0,10).map(x=><div key={x.part_key} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--color-border)"}}><b>{x.part_key}</b><span>{t("warehouse.shelfLife.atRiskLabels",{expired:x.expired,expiring:x.expiring})}</span></div>)}{!data.parts.some(x=>x.expired+x.expiring>0)&&<p>{t("warehouse.shelfLife.noPartHasAContainerAtRisk")}</p>}</section>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
   {metric(t("warehouse.shelfLife.expiring7"),String(analytics.counts[1].count),t("warehouse.shelfLife.immediateAttention"),"#dc8a18")}
   {metric(t("warehouse.shelfLife.expiring90"),String(analytics.at90),t("warehouse.shelfLife.planConsumption"),"#6478c8")}
   {metric(t("warehouse.shelfLife.coverage"),data.summary.total?(100*analytics.checked/data.summary.total).toFixed(1)+"%":"—",t("warehouse.shelfLife.knownExpiration"))}
   {metric(t("warehouse.shelfLife.nonOkPlex"),String(analytics.held),t("warehouse.shelfLife.separateFromExpiration"))}
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,420px),1fr))",gap:14}}>
   <section style={panel}><h2 style={{fontSize:16,margin:"0 0 6px"}}>{t("warehouse.shelfLife.expirationBuckets")}</h2><p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>{t("warehouse.shelfLife.fixedHorizonNote")}</p>
    {chartBars(analytics.counts.map(x=>({name:x.label,value:x.count,color:x.color})),t("warehouse.shelfLife.noData"))}</section>
   <section style={panel}><h2 style={{fontSize:16,margin:"0 0 6px"}}>{t("warehouse.shelfLife.locationConcentration")}</h2><p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>{t("warehouse.shelfLife.locationScope")}</p>
    {chartBars(analytics.areas.map(x=>({name:`${x.name} · ${x.total} ${t("warehouse.shelfLife.containersShort")}`,value:x.risk,color:"#d97706"})),t("warehouse.shelfLife.noRiskWithin30"))}</section>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,350px),1fr))",gap:14}}>
   <section style={panel}><h2 style={{fontSize:16,margin:"0 0 12px"}}>{t("warehouse.shelfLife.materialConcentration")}</h2>
    {chartBars(analytics.material.map(x=>({name:x.name,value:x.count,color:"#d97706"})),t("warehouse.shelfLife.noRiskWithin30"))}</section>
   <section style={panel}><h2 style={{fontSize:16,margin:"0 0 12px"}}>{t("warehouse.shelfLife.nextExpirations")}</h2>
    {analytics.next.length===0?<p style={{fontSize:13,color:"var(--color-text-secondary)"}}>{t("warehouse.shelfLife.noUpcoming")}</p>:<div style={{display:"grid",gap:9}}>{analytics.next.map(x=><button key={x.serial_no} type="button" onClick={()=>{setSearch(x.serial_no);setLocation("");setStatus("");document.getElementById("shelf-life-details")?.scrollIntoView({behavior:"smooth"})}} style={{...control,textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><span><strong>{x.serial_no}</strong><small style={{display:"block",color:"var(--color-text-secondary)"}}>{x.location} · {x.expired_date}</small></span><strong style={{color:x.days_remaining!==null&&x.days_remaining<=30?"#d97706":"var(--color-text-primary)"}}>{x.days_remaining} {t("warehouse.shelfLife.days")}</strong></button>)}</div>}</section>
  </div>
  <section id="shelf-life-details" style={panel}><h2 style={{fontSize:16,margin:"0 0 12px"}}>{t("warehouse.shelfLife.containerDetails")}<span style={{fontSize:12,fontWeight:400}}>({rows.length})</span></h2><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
   <label style={{display:"flex",gap:5,alignItems:"center",...control}}><Search size={16}/><input aria-label={t("warehouse.shelfLife.searchContainerOrPart")} placeholder={t("warehouse.shelfLife.serialPartKeyLocation")} value={search} onChange={e=>setSearch(e.target.value)} style={{border:0,background:"transparent",color:"inherit",outline:0}}/></label>
   <select aria-label={t("warehouse.shelfLife.locationFilter")} style={control} value={location} onChange={e=>setLocation(e.target.value)}><option value="">{t("warehouse.shelfLife.allLocations")}</option>{locations.map(v=><option key={v} value={v}>{v}</option>)}</select>
   <select aria-label={t("warehouse.shelfLife.statusFilter")} style={control} value={status} onChange={e=>setStatus(e.target.value)}><option value="">{t("warehouse.shelfLife.allStatuses")}</option>{(["expired","expiring","ok","unknown"] as Status[]).map(v=><option key={v} value={v}>{titles[v]}</option>)}</select>
  </div>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{[t("warehouse.shelfLife.serialNo"),t("warehouse.shelfLife.partKey"),t("warehouse.shelfLife.location"),t("warehouse.shelfLife.qty"),t("warehouse.shelfLife.shelfDate"),t("warehouse.shelfLife.expiration"),t("warehouse.shelfLife.daysLeft"),t("warehouse.shelfLife.status")].map(x=><th key={x} style={{textAlign:"left",padding:10,borderBottom:"1px solid var(--color-border)"}}>{x}</th>)}</tr></thead><tbody>{rows.map(x=><tr key={x.serial_no} onClick={()=>setExpanded(expanded===x.serial_no?null:x.serial_no)} style={{cursor:"pointer",background:expanded===x.serial_no?"var(--color-bg)":"transparent"}}><td style={{padding:10}}>{x.serial_no}</td><td>{x.part_key}</td><td>{x.location}</td><td>{x.quantity}</td><td>{x.shelf_date??"—"}</td><td>{x.expired_date??"—"}</td><td>{x.days_remaining??"—"}</td><td><b style={{color:colors[x.status]}}>{titles[x.status]}</b>{expanded===x.serial_no&&<div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{t("warehouse.shelfLife.plexStatus")} {x.container_status??"—"}</div>}</td></tr>)}</tbody></table>{rows.length===0&&<p>{t("warehouse.shelfLife.noMatchingContainers")}</p>}</div>
  </section></>}
 </div>
}
