import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Button, ButtonGroup, Checkbox, Form, FormFooter, FormSection, Heading, Label, SectionMessage, Select, Stack, Text, Textfield, useForm } from '@forge/react';
import { invoke } from '@forge/bridge';

const card = { padding:'space.300', borderColor:'color.border', borderWidth:'border.width', borderStyle:'solid', borderRadius:'border.radius' };
const mutedPanel = { padding:'space.200', backgroundColor:'color.background.neutral.subtle', borderRadius:'border.radius' };

const App=()=>{
  const [data,setData] = useState(null);
  const [msg,setMsg] = useState('');
  const load = async()=>setData(await invoke('getAdminData'));
  useEffect(()=>{load();},[]);
  const { handleSubmit, register, getFieldId } = useForm();
  if(!data) return <Stack space="space.200"><Heading size="large">System Alert Manager</Heading><Text>Loading configuration…</Text></Stack>;

  const add = async v => {
    await invoke('saveContact',{
      ...v,
      priorities:Array.isArray(v.priorities)?v.priorities.map(p=>p?.value ?? p).filter(Boolean):(v.priorities?[v.priorities?.value ?? v.priorities]:[]),
      smsAlerts:!!v.smsAlerts,
      emailAlerts:!!v.emailAlerts,
      monthlyTestAlerts:!!v.monthlyTestAlerts
    });
    setMsg('Contact saved successfully.');
    await load();
  };

  const saveSettings = async v => {
    await invoke('saveSettings',v);
    setMsg('App settings saved successfully.');
    await load();
  };

  const configured = Boolean(data.settings.clientFieldId && data.settings.allowedProjectKey && data.settings.fromName);
  const liveContacts = data.contacts.filter(c=>c.priorities?.length && (c.emailAlerts || c.smsAlerts)).length;
  const testContacts = data.contacts.filter(c=>c.monthlyTestAlerts).length;

  return <Stack space="space.400">
    <Stack space="space.100">
      <Heading size="xlarge">System Alert Manager</Heading>
      <Text>Configure alert delivery, client contacts and monthly test recipients from one place.</Text>
    </Stack>

    {msg && <SectionMessage appearance="success" title="Saved"><Text>{msg}</Text></SectionMessage>}

    <Box xcss={mutedPanel}>
      <Stack space="space.100">
        <Heading size="medium">Configuration overview</Heading>
        <Text>{configured ? 'Ready for alert configuration' : 'Setup needs attention'} · {data.contacts.length} contact{data.contacts.length===1?'':'s'} · {liveContacts} live alert recipient{liveContacts===1?'':'s'} · {testContacts} monthly test recipient{testContacts===1?'':'s'}</Text>
        {!configured && <Text>Complete the required app settings below before relying on the alert workflow.</Text>}
      </Stack>
    </Box>

    <Box xcss={card}>
      <Stack space="space.200">
        <Stack space="space.050">
          <Heading size="medium">App settings</Heading>
          <Text>Connect System Alert Manager to the Jira project and client field used by your alert workflow.</Text>
        </Stack>
        <Form onSubmit={handleSubmit(saveSettings)}>
          <FormSection>
            <Label labelFor={getFieldId('clientFieldId')}>Client Jira field ID</Label><Textfield {...register('clientFieldId',{defaultValue:data.settings.clientFieldId})} placeholder="customfield_12345" />
            <Text>Custom field containing the client or organisation identifier used to select recipients.</Text>
            <Label labelFor={getFieldId('allowedProjectKey')}>Allowed project key</Label><Textfield {...register('allowedProjectKey',{defaultValue:data.settings.allowedProjectKey})} placeholder="SD" />
            <Text>Alerts are restricted to this Jira project.</Text>
            <Label labelFor={getFieldId('fromName')}>Sender display name</Label><Textfield {...register('fromName',{defaultValue:data.settings.fromName})} placeholder="Nuvriqo System Alerts" />
          </FormSection>
          <FormFooter><Button appearance="primary" type="submit">Save settings</Button></FormFooter>
        </Form>
      </Stack>
    </Box>

    <Box xcss={card}>
      <Stack space="space.200">
        <Stack space="space.050">
          <Heading size="medium">Add alert contact</Heading>
          <Text>Create a recipient for live incident alerts, the monthly system test, or both.</Text>
        </Stack>
        <Form onSubmit={handleSubmit(add)}><FormSection>
          <Label labelFor={getFieldId('clientCode')}>Client code</Label><Textfield {...register('clientCode')} placeholder="ABC" />
          <Label labelFor={getFieldId('clientName')}>Client name</Label><Textfield {...register('clientName')} placeholder="Example Client" />
          <Label labelFor={getFieldId('name')}>Contact or distribution list name</Label><Textfield {...register('name')} placeholder="Operations Team" />
          <Label labelFor={getFieldId('email')}>Email address</Label><Textfield {...register('email')} type="email" placeholder="alerts@example.com" />
          <Label labelFor={getFieldId('mobile')}>Mobile number</Label><Textfield {...register('mobile')} placeholder="+353…" />
          <Label labelFor={getFieldId('priorities')}>Live incident priorities</Label><Select {...register('priorities')} isMulti options={[{label:'P1',value:'P1'},{label:'P2',value:'P2'},{label:'P3',value:'P3'},{label:'Highest',value:'Highest'},{label:'High',value:'High'}]} />
          <Text>Select the priorities for which this contact should be available during a live incident.</Text>
          <Checkbox {...register('emailAlerts')} label="Receive email alerts" />
          <Checkbox {...register('smsAlerts')} label="Receive SMS alerts" />
          <Checkbox {...register('monthlyTestAlerts')} label="Receive monthly system alert test" />
        </FormSection><FormFooter><Button appearance="primary" type="submit">Add contact</Button></FormFooter></Form>
      </Stack>
    </Box>

    <Stack space="space.200">
      <Stack space="space.050">
        <Heading size="medium">Alert contacts</Heading>
        <Text>Recipient details are stored securely in Forge storage. Sensitive values are masked in this view.</Text>
      </Stack>
      {data.contacts.length===0 ? <SectionMessage title="No contacts yet"><Text>Add your first alert contact above to build the recipient directory.</Text></SectionMessage> : data.contacts.map(c=><Box key={c.id} xcss={card}><Stack space="space.100"><Heading size="small">{c.clientCode} · {c.name}</Heading><Text>{c.clientName || 'Client name not set'}</Text><Text>{typeof c.email === 'string' && c.email ? c.email.replace(/(^.).*(@.*$)/, '$1••••$2') : 'No email'} · {c.mobileMasked || 'No mobile'}</Text><Text>{c.priorities.length ? `Live priorities: ${c.priorities.join(', ')}` : 'No live priorities'} · {c.emailAlerts?'Email on':'Email off'} · {c.smsAlerts?'SMS on':'SMS off'} · {c.monthlyTestAlerts?'Monthly test on':'Monthly test off'}</Text><ButtonGroup><Button appearance="danger" onClick={async()=>{await invoke('deleteContact',{id:c.id});setMsg('Contact deleted.');await load();}}>Delete contact</Button></ButtonGroup></Stack></Box>)}
    </Stack>
  </Stack>;
};

ForgeReconciler.render(<React.StrictMode><App/></React.StrictMode>);
