import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Button, ButtonGroup, Checkbox, Form, FormFooter, FormSection, Heading, Inline, Label, Lozenge, SectionMessage, Select, Stack, Text, Textfield, useForm } from '@forge/react';
import { invoke } from '@forge/bridge';

const card = { padding:'space.300', borderColor:'color.border', borderWidth:'border.width', borderStyle:'solid', borderRadius:'border.radius' };
const mutedPanel = { padding:'space.200', backgroundColor:'color.background.neutral.subtle', borderRadius:'border.radius' };
const statCard = { padding:'space.250', borderColor:'color.border', borderWidth:'border.width', borderStyle:'solid', borderRadius:'border.radius', minWidth:'180px' };

const App=()=>{
  const [data,setData] = useState(null);
  const [msg,setMsg] = useState('');
  const [view,setView] = useState('overview');
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
    setView('contacts');
  };

  const saveSettings = async v => {
    await invoke('saveSettings',v);
    setMsg('App settings saved successfully.');
    await load();
  };

  const configured = Boolean(data.settings.clientFieldId && data.settings.allowedProjectKey && data.settings.fromName);
  const liveContacts = data.contacts.filter(c=>c.priorities?.length && (c.emailAlerts || c.smsAlerts)).length;
  const testContacts = data.contacts.filter(c=>c.monthlyTestAlerts).length;
  const emailContacts = data.contacts.filter(c=>c.emailAlerts).length;
  const smsContacts = data.contacts.filter(c=>c.smsAlerts).length;

  const nav = [
    ['overview','Overview'],
    ['contacts','Contacts'],
    ['add','Add contact'],
    ['configuration','Configuration']
  ];

  return <Stack space="space.300">
    <Stack space="space.100">
      <Text>NUVRIQO · ALERT OPERATIONS</Text>
      <Inline spread="space-between" alignBlock="center">
        <Stack space="space.050">
          <Heading size="xlarge">System Alert Manager</Heading>
          <Text>Manage incident alert recipients, delivery channels and Jira integration from one workspace.</Text>
        </Stack>
        <Lozenge appearance={configured?'success':'moved'}>{configured?'Ready':'Setup required'}</Lozenge>
      </Inline>
    </Stack>

    <Inline space="space.100" shouldWrap>
      {nav.map(([id,label])=><Button key={id} appearance={view===id?'primary':'subtle'} onClick={()=>setView(id)}>{label}</Button>)}
    </Inline>

    {msg && <SectionMessage appearance="success" title="Saved"><Text>{msg}</Text></SectionMessage>}

    {view==='overview' && <Stack space="space.300">
      <Inline space="space.150" shouldWrap>
        <Box xcss={statCard}><Stack space="space.050"><Text>Total contacts</Text><Heading size="large">{data.contacts.length}</Heading><Text>Configured recipients</Text></Stack></Box>
        <Box xcss={statCard}><Stack space="space.050"><Text>Live recipients</Text><Heading size="large">{liveContacts}</Heading><Text>Enabled for incident alerts</Text></Stack></Box>
        <Box xcss={statCard}><Stack space="space.050"><Text>Email enabled</Text><Heading size="large">{emailContacts}</Heading><Text>Contacts using email</Text></Stack></Box>
        <Box xcss={statCard}><Stack space="space.050"><Text>SMS enabled</Text><Heading size="large">{smsContacts}</Heading><Text>Contacts using SMS</Text></Stack></Box>
        <Box xcss={statCard}><Stack space="space.050"><Text>Test recipients</Text><Heading size="large">{testContacts}</Heading><Text>Monthly test enabled</Text></Stack></Box>
      </Inline>

      <Box xcss={mutedPanel}><Stack space="space.100">
        <Inline spread="space-between" alignBlock="center"><Heading size="medium">Configuration health</Heading><Lozenge appearance={configured?'success':'moved'}>{configured?'Configured':'Needs attention'}</Lozenge></Inline>
        <Text>{configured ? `Alerts are restricted to project ${data.settings.allowedProjectKey} and the core Jira mapping is configured.` : 'Complete the required Jira field, project and sender settings before relying on the live alert workflow.'}</Text>
        <Button appearance="subtle" onClick={()=>setView('configuration')}>Review configuration</Button>
      </Stack></Box>

      <Box xcss={card}><Stack space="space.150">
        <Inline spread="space-between" alignBlock="center"><Stack space="space.050"><Heading size="medium">Recipient directory</Heading><Text>Contacts available to the live alert and monthly test workflows.</Text></Stack><Button appearance="primary" onClick={()=>setView('add')}>Add contact</Button></Inline>
        {data.contacts.length===0 ? <Text>No contacts configured yet.</Text> : data.contacts.slice(0,5).map(c=><Inline key={c.id} spread="space-between" alignBlock="center"><Stack space="space.050"><Text>{c.clientCode} · {c.name}</Text><Text>{c.clientName || 'Client name not set'}</Text></Stack><Text>{c.priorities?.length ? c.priorities.join(', ') : 'Test only'}</Text></Inline>)}
        {data.contacts.length>5 && <Button appearance="subtle" onClick={()=>setView('contacts')}>View all {data.contacts.length} contacts</Button>}
      </Stack></Box>
    </Stack>}

    {view==='configuration' && <Box xcss={card}><Stack space="space.200">
      <Stack space="space.050"><Heading size="medium">App configuration</Heading><Text>Connect System Alert Manager to the Jira project and client field used by the alert workflow.</Text></Stack>
      <Form onSubmit={handleSubmit(saveSettings)}><FormSection>
        <Label labelFor={getFieldId('clientFieldId')}>Client Jira field ID</Label><Textfield {...register('clientFieldId',{defaultValue:data.settings.clientFieldId})} placeholder="customfield_12345" />
        <Text>Custom field containing the client or organisation identifier used to select recipients.</Text>
        <Label labelFor={getFieldId('allowedProjectKey')}>Allowed project key</Label><Textfield {...register('allowedProjectKey',{defaultValue:data.settings.allowedProjectKey})} placeholder="SD" />
        <Text>Alerts are restricted to this Jira project.</Text>
        <Label labelFor={getFieldId('fromName')}>Sender display name</Label><Textfield {...register('fromName',{defaultValue:data.settings.fromName})} placeholder="Nuvriqo System Alerts" />
      </FormSection><FormFooter><Button appearance="primary" type="submit">Save configuration</Button></FormFooter></Form>
    </Stack></Box>}

    {view==='add' && <Box xcss={card}><Stack space="space.200">
      <Stack space="space.050"><Heading size="medium">Add alert contact</Heading><Text>Create a recipient for live incident alerts, the monthly system test, or both.</Text></Stack>
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
      </FormSection><FormFooter><Button appearance="subtle" onClick={()=>setView('contacts')}>Cancel</Button><Button appearance="primary" type="submit">Add contact</Button></FormFooter></Form>
    </Stack></Box>}

    {view==='contacts' && <Stack space="space.200">
      <Inline spread="space-between" alignBlock="center"><Stack space="space.050"><Heading size="medium">Alert contacts</Heading><Text>Recipient details are stored securely in Forge storage. Sensitive values are masked in this view.</Text></Stack><Button appearance="primary" onClick={()=>setView('add')}>Add contact</Button></Inline>
      {data.contacts.length===0 ? <SectionMessage title="No contacts yet"><Text>Add your first alert contact to build the recipient directory.</Text></SectionMessage> : data.contacts.map(c=><Box key={c.id} xcss={card}><Stack space="space.100">
        <Inline spread="space-between" alignBlock="center"><Stack space="space.050"><Heading size="small">{c.clientCode} · {c.name}</Heading><Text>{c.clientName || 'Client name not set'}</Text></Stack><Lozenge appearance={c.priorities?.length && (c.emailAlerts||c.smsAlerts)?'success':'default'}>{c.priorities?.length && (c.emailAlerts||c.smsAlerts)?'Live':'Test / inactive'}</Lozenge></Inline>
        <Text>{typeof c.email === 'string' && c.email ? c.email.replace(/(^.).*(@.*$)/, '$1••••$2') : 'No email'} · {c.mobileMasked || 'No mobile'}</Text>
        <Text>{c.priorities.length ? `Live priorities: ${c.priorities.join(', ')}` : 'No live priorities'} · {c.emailAlerts?'Email on':'Email off'} · {c.smsAlerts?'SMS on':'SMS off'} · {c.monthlyTestAlerts?'Monthly test on':'Monthly test off'}</Text>
        <ButtonGroup><Button appearance="danger" onClick={async()=>{await invoke('deleteContact',{id:c.id});setMsg('Contact deleted.');await load();}}>Delete contact</Button></ButtonGroup>
      </Stack></Box>)}
    </Stack>}
  </Stack>;
};

ForgeReconciler.render(<React.StrictMode><App/></React.StrictMode>);
