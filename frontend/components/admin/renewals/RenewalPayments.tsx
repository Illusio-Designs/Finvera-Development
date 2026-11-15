"use client";
import {useEffect,useRef,useState} from 'react';
import {api,workspaceApi} from '@/lib/adminApi';
import {userRoles} from '@/lib/permissions';
import Select from '@/components/Select';
import DatePicker from '@/components/ui/DatePicker';
import {dialog} from '@/lib/dialog';
import {indiaToday} from '@/lib/socialWorkflow';
export default function RenewalPayments({id,onDirty,onBusy}:{id:number;onDirty:(v:boolean)=>void;onBusy:(v:boolean)=>void}){
 const [items,setItems]=useState<any[]>([]),[total,setTotal]=useState<number|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[admin,setAdmin]=useState(false);
 const [amount,setAmount]=useState(''),[paidOn,setPaidOn]=useState(indiaToday()),[method,setMethod]=useState('bank'),[reference,setReference]=useState(''),[note,setNote]=useState('');const key=useRef(crypto.randomUUID());
 useEffect(()=>{onDirty(!!(amount||reference||note||method!=='bank'||paidOn!==indiaToday()));},[amount,reference,note,method,paidOn,onDirty]);
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 async function load(){try{const r=await workspaceApi.payments(id);setItems(r.items);setTotal(r.totalPaid);}catch(e:any){setError(e.message);}}
 useEffect(()=>{load();api.me().then(r=>setAdmin(userRoles(r.user??r).includes('admin'))).catch(()=>{});},[id]);
 async function save(){if(busy)return;setBusy(true);setError('');try{await workspaceApi.recordPayment(id,{amount:Number(amount),paidOn,method,reference,note,requestKey:key.current});key.current=crypto.randomUUID();setAmount('');setReference('');setNote('');setMethod('bank');setPaidOn(indiaToday());await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function undo(payment:any){const reason=await dialog.prompt({title:'Void this payment record?',message:'The original record remains in the ledger. This does not reverse a bank payment.',confirmText:'Void record'});if(!reason)return;setBusy(true);setError('');try{await workspaceApi.voidPayment(payment.id,reason);await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section aria-label="Payment history"><h3>Payment history</h3><p>Recorded receipts · INR. Recording a payment does not transfer money or change the renewal date.</p><p><b>Total recorded: {total===null?'Loading…':`₹${total.toLocaleString('en-IN')}`}</b></p>{error&&<p role="alert">{error}<button className="sh-btn" type="button" onClick={load}>Retry ledger</button></p>}
 <div className="adm-field"><label htmlFor="payment-amount">Amount · INR</label><input id="payment-amount" type="number" min="1" step="1" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)}/></div>
 <div className="adm-field"><label>Paid on</label><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}><DatePicker value={paidOn} onChange={v=>{if(!busy)setPaidOn(v);}}/></fieldset></div><div className="adm-field"><label>Method</label><Select ariaLabel="Payment method" value={method} disabled={busy} onChange={setMethod} options={['bank','upi','cash','card','other'].map(value=>({value,label:value.toUpperCase()}))}/></div>
 <div className="adm-field"><label htmlFor="payment-ref">Reference</label><input id="payment-ref" maxLength={120} value={reference} disabled={busy} onChange={e=>setReference(e.target.value)}/></div><div className="adm-field"><label htmlFor="payment-note">Note</label><textarea id="payment-note" maxLength={1000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></div><button className="sh-btn pri" type="button" disabled={busy||total===null||!amount} onClick={save}>{busy?'Saving…':'Record payment'}</button>
 <ul>{items.map(p=><li key={p.id}><p><b>₹{Number(p.amount).toLocaleString('en-IN')}</b> · {p.paidOn} · {p.method}{p.voidedAt?' · Voided':''}</p><p>{p.reference} {p.note}</p><small>Recorded by {p.recordedByName}{p.voidReason?` · ${p.voidReason}`:''}</small>{admin&&!p.voidedAt&&<button type="button" className="sh-btn" disabled={busy} onClick={()=>undo(p)}>Void record</button>}</li>)}</ul>{!items.length&&total!==null&&<p>No payments recorded.</p>}
 </section>;
}
