import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Button, ButtonGroup, Checkbox, Form, FormFooter, FormSection, Heading, Label, SectionMessage, Select, Stack, Text, Textfield, useForm } from '@forge/react';
import { invoke } from '@forge/bridge';

const App=()=>{
  const [data,setData] = useState(null);
  const [msg,setMsg] = useState('');
  const load = async()=>setData(await invoke('getAdminData'));
  useEffect(()=>{load();},[]);
  const { handleSubmit, register, getFieldId } = useForm();
  if(!data) return <Text>Loading…</Text>;

  const add = async v => {
    await invoke('saveContact',{
      ...v,
      priorities:Array.isArray(v.priorities)?v.priorities.map(p=>p?.value ?? p).filter(Boolean):(v.priorities?[v.priorities?.value ?? v.priorities]:[]),
      smsAlerts:!!v.smsAlerts,
      emailAlerts:!!v.emailAlerts,
      monthlyTestAlerts:!!v.monthlyTestAlerts
    });
    setMsg('Contact saved.');
    await load();
  };

  const saveSettings = async v => {
    await invoke('saveSettings',v);
    setMsg('Settings saved.');
    await load();
  };

  return <Stack space="space.300">
    <Heading size="xlarge">System Alert Contacts</Heading>
    <Text>Maintain the client contact directory used by the Send System Alert action. Contact records are stored encrypted in Forge storage.</Text>
    {msg && <SectionMessage appearance="success"><Text>{msg}</Text></SectionMessage>}

    <Box xcss={{padding:'space.300',borderColor:'color.border',borderWidth:'border.width',borderStyle:'solid',borderRadius:'border.radius'}}>
      <Heading size="medium">App settings</Heading>
      <Form onSubmit={handleSubmit(saveSettings)}>
        <FormSection>
          <Label labelFor={getFieldId('clientFieldId')}>Client Jira field ID</Label><Textfield {...register('clientFieldId',{defaultValue:data.settings.clientFieldId})} placeholder="customfield_12345" />
          <Label labelFor={getFieldId('allowedProjectKey')}>Allowed project</Label><Textfield {...register('allowedProjectKey',{defaultValue:data.settings.allowedProjectKey})} />
          <Label labelFor={getFieldId('fromName')}>Sender display name</Label><Textfield {...register('fromName',{defaultValue:data.settings.fromName})} />
        </FormSection>
        <FormFooter><Button appearance="primary" type="submit">Save settings</Button></FormFooter>
      </Form>
    </Box>

    <Box xcss={{padding:'space.300',borderColor:'color.border',borderWidth:'border.width',borderStyle:'solid',borderRadius:'border.radius'}}>
      <Heading size="medium">Add contact</Heading>
      <Text>Monthly Test is independent of the incident priority settings, so you can maintain a dedicated test distribution list.</Text>
      <Form onSubmit={handleSubmit(add)}><FormSection>
        <Label labelFor={getFieldId('clientCode')}>Client code</Label><Textfield {...register('clientCode')} placeholder="RYR" />
        <Label labelFor={getFieldId('clientName')}>Client name</Label><Textfield {...register('clientName')} placeholder="Ryanair" />
        <Label labelFor={getFieldId('name')}>Contact / distribution list name</Label><Textfield {...register('name')} />
        <Label labelFor={getFieldId('email')}>Email address</Label><Textfield {...register('email')} type="email" />
        <Label labelFor={getFieldId('mobile')}>Mobile number</Label><Textfield {...register('mobile')} placeholder="+353..." />
        <Label labelFor={getFieldId('priorities')}>Live incident priorities</Label><Select {...register('priorities')} isMulti options={[{label:'P1',value:'P1'},{label:'P2',value:'P2'},{label:'P3',value:'P3'},{label:'Highest',value:'Highest'},{label:'High',value:'High'}]} />
        <Checkbox {...register('emailAlerts')} label="Receive email alerts" />
        <Checkbox {...register('smsAlerts')} label="Receive SMS alerts" />
        <Checkbox {...register('monthlyTestAlerts')} label="Receive Monthly System Alert Test" />
      </FormSection><FormFooter><Button appearance="primary" type="submit">Add contact</Button></FormFooter></Form>
    </Box>

    <Heading size="medium">Current contacts</Heading>
    {data.contacts.length===0 ? <SectionMessage><Text>No contacts have been added yet.</Text></SectionMessage> : data.contacts.map(c=><Box key={c.id} xcss={{padding:'space.200',borderBottomColor:'color.border',borderBottomWidth:'border.width',borderBottomStyle:'solid'}}><Stack space="space.050"><Heading size="small">{c.clientCode} — {c.name}</Heading><Text>{typeof c.email === 'string' && c.email ? c.email.replace(/(^.).*(@.*$)/, '$1••••$2') : 'No email'} · {c.mobileMasked || 'No mobile'}</Text><Text>{c.priorities.length ? `Live: ${c.priorities.join(', ')}` : 'Live: None'}{c.emailAlerts?' · Email':''}{c.smsAlerts?' · SMS':''}{c.monthlyTestAlerts?' · Monthly Test':''}</Text><ButtonGroup><Button appearance="danger" onClick={async()=>{await invoke('deleteContact',{id:c.id});await load();}}>Delete</Button></ButtonGroup></Stack></Box>)}
  </Stack>;
};

ForgeReconciler.render(<React.StrictMode><App/></React.StrictMode>);
