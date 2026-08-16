import React, { useEffect, useMemo, useState } from 'react';
import ForgeReconciler, { Box, Button, Checkbox, Form, FormFooter, FormSection, Heading, Label, Radio, RadioGroup, SectionMessage, Stack, Text, TextArea, Textfield, useForm, useProductContext } from '@forge/react';
import { invoke, view } from '@forge/bridge';

const App=()=>{
  const ctx=useProductContext();
  const issueKey=ctx?.extension?.issue?.key || ctx?.platformContext?.issueKey;
  const [data,setData]=useState(null);
  const [alertType,setAlertType]=useState('initial');
  const [selected,setSelected]=useState([]);
  const [done,setDone]=useState(null);
  const [err,setErr]=useState('');
  const {handleSubmit,register,getFieldId}=useForm();

  useEffect(()=>{
    if(issueKey) invoke('getIssueAlertData',{issueKey}).then(d=>setData(d)).catch(e=>setErr(e.message));
  },[issueKey]);

  const eligibleContacts = useMemo(()=>{
    if(!data) return [];
    return data.contacts.filter(c => alertType==='monthly-test' ? c.monthlyTestAlerts : c.priorities?.includes(data.priority));
  },[data, alertType]);

  useEffect(()=>{
    setSelected(eligibleContacts.map(c=>c.id));
  },[alertType, data]);

  if(err && !data) return <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage>;
  if(!data) return <Text>Loading alert details…</Text>;

  const send=async v=>{
    setErr('');
    try{
      const res=await invoke('sendAlert',{
        ...v,
        alertType,
        issueKey:data.issueKey,
        summary:data.summary,
        description:data.description,
        priority:data.priority,
        clientCode:data.clientCode,
        testMonth:data.monthlyTestMonth,
        contactIds:selected,
        sendEmail:!!v.sendEmail,
        sendSms:!!v.sendSms
      });
      setDone(res);
    }catch(e){setErr(e.message)}
  };

  if(done) return <Stack space="space.200">
    <SectionMessage appearance="success">
      <Heading size="small">{done.isTest ? 'Monthly test sent' : 'System Alert sent'}</Heading>
      <Text>Email recipients: {done.email.attempted}. SMS sent: {done.sms.sent}.</Text>
      {done.isTest && <Text>{done.testMonth} has been recorded in the monthly test history.</Text>}
    </SectionMessage>
    {done.sms.failed?.length>0&&<SectionMessage appearance="warning"><Text>{done.sms.failed.length} SMS message(s) failed. Check Forge logs for details.</Text></SectionMessage>}
    <Button appearance="primary" onClick={()=>view.close()}>Close</Button>
  </Stack>;

  const isTest = alertType === 'monthly-test';
  const defaultMessage = isTest
    ? `This is the scheduled ${data.monthlyTestMonth} test of the System Alert notification service. There is no live service incident and no action is required unless acknowledgement forms part of the agreed test procedure.`
    : data.description || 'Our priority escalation process has started and the team is actively investigating. A further update will follow shortly.';

  return <Stack space="space.300">
    <Heading size="large">Send System Alert</Heading>
    <Box xcss={{padding:'space.200',backgroundColor:'color.background.neutral',borderRadius:'border.radius'}}>
      <Text><strong>{data.issueKey}</strong> · {data.clientCode || 'No client mapped'} · {data.priority}</Text>
      <Heading size="small">{data.summary}</Heading>
    </Box>

    <Form onSubmit={handleSubmit(send)}><FormSection>
      <Label labelFor={getFieldId('alertType')}>Alert type</Label>
      <RadioGroup value={alertType} onChange={e=>setAlertType(e.target.value)}>
        <Radio value="initial" label="Initial alert"/>
        <Radio value="update" label="Incident update"/>
        <Radio value="resolved" label="Service restored / resolved"/>
        <Radio value="monthly-test" label={`Monthly System Alert Test — ${data.monthlyTestMonth}`}/>
      </RadioGroup>

      {isTest && <SectionMessage appearance={data.monthlyTestCompleted?'warning':'information'}>
        <Heading size="small">TEST ONLY</Heading>
        <Text>{data.monthlyTestCompleted ? `${data.monthlyTestMonth} has already been recorded as completed. You can still resend the test if needed.` : `${data.monthlyTestMonth} has not yet been recorded as completed for ${data.clientCode}.`}</Text>
      </SectionMessage>}

      <Heading size="small">Recipients</Heading>
      {eligibleContacts.length===0&&<SectionMessage appearance="warning"><Text>{isTest ? 'No contacts are enabled for Monthly Test alerts. Enable Monthly Test on the required contacts in System Alert Contacts.' : `No contacts are enabled for ${data.priority} alerts. Check the contact priorities in System Alert Contacts.`}</Text></SectionMessage>}
      {eligibleContacts.map(c=><Checkbox key={c.id} label={`${c.name} — ${c.email||'no email'}${c.mobileMasked?` / ${c.mobileMasked}`:''}`} isChecked={selected.includes(c.id)} onChange={()=>setSelected(s=>s.includes(c.id)?s.filter(x=>x!==c.id):[...s,c.id])}/>)}

      {!isTest && <>
        <Label labelFor={getFieldId('startTime')}>Issue start time</Label>
        <Textfield {...register('startTime')} placeholder="11 Aug 2026 16:00" />
        <Label labelFor={getFieldId('nextUpdate')}>Next update due</Label>
        <Textfield {...register('nextUpdate')} placeholder="17:00 Irish time" />
      </>}

      <Label labelFor={getFieldId('message')}>{isTest ? 'Test message' : 'Current situation'}</Label>
      <TextArea key={alertType} {...register('message',{defaultValue:defaultMessage})} resize="vertical" />
      <Checkbox {...register('sendEmail')} label="Send email" defaultChecked={data.settings.emailEnabled}/>
      <Checkbox {...register('sendSms')} label="Send SMS through Twilio" defaultChecked={data.settings.smsEnabled}/>
    </FormSection>
    {err&&<SectionMessage appearance="error"><Text>{err}</Text></SectionMessage>}
    <FormFooter><Button appearance="subtle" onClick={()=>view.close()}>Cancel</Button><Button appearance="primary" type="submit" isDisabled={selected.length===0}>{isTest ? 'Send Monthly Test' : 'Send System Alert'}</Button></FormFooter>
    </Form>

    {isTest && data.monthlyHistory.length>0&&<>
      <Heading size="small">Monthly test history — {data.clientCode}</Heading>
      {data.monthlyHistory.slice(0,6).map((h,i)=><Text key={i}>{h.monthLabel || h.monthKey} — {new Date(h.at).toLocaleString()} — Email {h.emailCount}, SMS {h.smsCount}</Text>)}
    </>}

    {!isTest && data.history.length>0&&<>
      <Heading size="small">Recent alert history</Heading>
      {data.history.slice(0,5).map((h,i)=><Text key={i}>{new Date(h.at).toLocaleString()} — {h.alertType} — Email {h.emailCount}, SMS {h.smsCount}</Text>)}
    </>}
  </Stack>;
};

ForgeReconciler.render(<React.StrictMode><App/></React.StrictMode>);
