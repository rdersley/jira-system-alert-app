import React, { useEffect, useMemo, useState } from 'react';
import ForgeReconciler, { Box, Button, Checkbox, Form, FormFooter, FormSection, Heading, Label, Radio, RadioGroup, SectionMessage, Stack, Text, TextArea, Textfield, useForm, useProductContext } from '@forge/react';
import { invoke, view } from '@forge/bridge';

const card={padding:'space.300',borderColor:'color.border',borderWidth:'border.width',borderStyle:'solid',borderRadius:'border.radius'};
const summaryPanel={padding:'space.200',backgroundColor:'color.background.neutral.subtle',borderRadius:'border.radius'};

const App=()=>{
  const ctx=useProductContext();
  const issueKey=ctx?.extension?.issue?.key || ctx?.platformContext?.issueKey;
  const [data,setData]=useState(null);
  const [alertType,setAlertType]=useState('initial');
  const [selected,setSelected]=useState([]);
  const [done,setDone]=useState(null);
  const [err,setErr]=useState('');
  const {handleSubmit,register,getFieldId}=useForm();

  useEffect(()=>{if(issueKey) invoke('getIssueAlertData',{issueKey}).then(setData).catch(e=>setErr(e.message));},[issueKey]);
  const eligibleContacts=useMemo(()=>!data?[]:data.contacts.filter(c=>alertType==='monthly-test'?c.monthlyTestAlerts:c.priorities?.includes(data.priority)),[data,alertType]);
  useEffect(()=>{setSelected(eligibleContacts.map(c=>c.id));},[alertType,data]);

  if(err&&!data) return <SectionMessage appearance="error" title="Unable to load System Alert"><Text>{err}</Text></SectionMessage>;
  if(!data) return <Stack space="space.100"><Heading size="large">Send System Alert</Heading><Text>Loading alert details…</Text></Stack>;

  const send=async v=>{setErr('');try{setDone(await invoke('sendAlert',{...v,alertType,issueKey:data.issueKey,summary:data.summary,description:data.description,priority:data.priority,clientCode:data.clientCode,testMonth:data.monthlyTestMonth,contactIds:selected,sendEmail:!!v.sendEmail,sendSms:!!v.sendSms}));}catch(e){setErr(e.message)}};

  if(done) return <Stack space="space.300">
    <Stack space="space.050"><Heading size="large">Alert delivery complete</Heading><Text>{done.isTest?'The monthly notification test has finished.':'The system alert has finished sending.'}</Text></Stack>
    <SectionMessage appearance="success" title={done.isTest?'Monthly test sent':'System Alert sent'}><Text>Email recipients: {done.email.attempted}. SMS sent: {done.sms.sent}.</Text>{done.isTest&&<Text>{done.testMonth} has been recorded in the monthly test history.</Text>}</SectionMessage>
    {done.sms.failed?.length>0&&<SectionMessage appearance="warning" title="Some SMS messages failed"><Text>{done.sms.failed.length} SMS message(s) failed. Check Forge logs for delivery details.</Text></SectionMessage>}
    <Button appearance="primary" onClick={()=>view.close()}>Done</Button>
  </Stack>;

  const isTest=alertType==='monthly-test';
  const defaultMessage=isTest?`This is the scheduled ${data.monthlyTestMonth} test of the System Alert notification service. There is no live service incident and no action is required unless acknowledgement forms part of the agreed test procedure.`:data.description||'Our priority escalation process has started and the team is actively investigating. A further update will follow shortly.';

  return <Stack space="space.400">
    <Stack space="space.050"><Heading size="xlarge">Send System Alert</Heading><Text>Review the incident, recipients and delivery channels before sending.</Text></Stack>

    <Box xcss={summaryPanel}><Stack space="space.050"><Text>{data.issueKey} · {data.clientCode||'No client mapped'} · {data.priority}</Text><Heading size="medium">{data.summary}</Heading></Stack></Box>

    <Form onSubmit={handleSubmit(send)}><Stack space="space.300"><Box xcss={card}><FormSection>
      <Heading size="medium">1. Choose alert type</Heading>
      <Text>Select the stage of the incident communication. This controls the default message and eligible recipients.</Text>
      <Label labelFor={getFieldId('alertType')}>Alert type</Label>
      <RadioGroup value={alertType} onChange={e=>setAlertType(e.target.value)}><Radio value="initial" label="Initial alert"/><Radio value="update" label="Incident update"/><Radio value="resolved" label="Service restored / resolved"/><Radio value="monthly-test" label={`Monthly System Alert Test — ${data.monthlyTestMonth}`}/></RadioGroup>
      {isTest&&<SectionMessage appearance={data.monthlyTestCompleted?'warning':'information'} title="Monthly test"><Text>{data.monthlyTestCompleted?`${data.monthlyTestMonth} has already been recorded as completed. You can resend it if required.`:`${data.monthlyTestMonth} has not yet been recorded as completed for ${data.clientCode}.`}</Text></SectionMessage>}
    </FormSection></Box>

    <Box xcss={card}><FormSection>
      <Heading size="medium">2. Confirm recipients</Heading><Text>Eligible contacts are selected automatically. Deselect anyone who should not receive this alert.</Text>
      {eligibleContacts.length===0&&<SectionMessage appearance="warning" title="No eligible recipients"><Text>{isTest?'No contacts are enabled for monthly test alerts. Enable Monthly Test for the required contacts in the app configuration.':`No contacts are enabled for ${data.priority} alerts. Check contact priority settings before sending.`}</Text></SectionMessage>}
      {eligibleContacts.map(c=><Checkbox key={c.id} label={`${c.name} — ${c.email||'no email'}${c.mobileMasked?` / ${c.mobileMasked}`:''}`} isChecked={selected.includes(c.id)} onChange={()=>setSelected(s=>s.includes(c.id)?s.filter(x=>x!==c.id):[...s,c.id])}/>)}
    </FormSection></Box>

    <Box xcss={card}><FormSection>
      <Heading size="medium">3. Review message</Heading>
      {!isTest&&<><Label labelFor={getFieldId('startTime')}>Issue start time</Label><Textfield {...register('startTime')} placeholder="29 Aug 2026 13:00"/><Label labelFor={getFieldId('nextUpdate')}>Next update due</Label><Textfield {...register('nextUpdate')} placeholder="14:00 Irish time"/></>}
      <Label labelFor={getFieldId('message')}>{isTest?'Test message':'Current situation'}</Label><TextArea key={alertType} {...register('message',{defaultValue:defaultMessage})} resize="vertical"/>
    </FormSection></Box>

    <Box xcss={card}><FormSection><Heading size="medium">4. Delivery channels</Heading><Text>Choose how the selected recipients should receive this communication.</Text><Checkbox {...register('sendEmail')} label="Send email" defaultChecked={data.settings.emailEnabled}/><Checkbox {...register('sendSms')} label="Send SMS through Twilio" defaultChecked={data.settings.smsEnabled}/></FormSection></Box>

    {err&&<SectionMessage appearance="error" title="Alert not sent"><Text>{err}</Text></SectionMessage>}
    <FormFooter><Button appearance="subtle" onClick={()=>view.close()}>Cancel</Button><Button appearance="primary" type="submit" isDisabled={selected.length===0}>{isTest?'Send monthly test':'Send System Alert'}</Button></FormFooter>
    </Stack></Form>

    {isTest&&data.monthlyHistory.length>0&&<Box xcss={card}><Stack space="space.100"><Heading size="medium">Monthly test history · {data.clientCode}</Heading>{data.monthlyHistory.slice(0,6).map((h,i)=><Text key={i}>{h.monthLabel||h.monthKey} · {new Date(h.at).toLocaleString()} · Email {h.emailCount} · SMS {h.smsCount}</Text>)}</Stack></Box>}
    {!isTest&&data.history.length>0&&<Box xcss={card}><Stack space="space.100"><Heading size="medium">Recent alert history</Heading>{data.history.slice(0,5).map((h,i)=><Text key={i}>{new Date(h.at).toLocaleString()} · {h.alertType} · Email {h.emailCount} · SMS {h.smsCount}</Text>)}</Stack></Box>}
  </Stack>;
};
ForgeReconciler.render(<React.StrictMode><App/></React.StrictMode>);
