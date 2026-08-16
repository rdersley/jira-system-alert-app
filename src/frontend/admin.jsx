import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, ButtonGroup, Checkbox, Form, FormFooter, FormSection,
  Heading, Label, SectionMessage, Select, Stack, Text, Textfield, useForm
} from '@forge/react';
import { invoke } from '@forge/bridge';

const PRIORITY_OPTIONS = [
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' }
];

const normalizeSelectedPriorities = (value) => {
  const arr = Array.isArray(value) ? value : (value ? [value] : []);
  return arr.map(p => p?.value ?? p).filter(Boolean);
};

function SettingsForm({ settings, onSaved }) {
  const { handleSubmit, register, getFieldId } = useForm({
    defaultValues: {
      clientFieldId: settings.clientFieldId || '',
      issueStartFieldId: settings.issueStartFieldId || 'customfield_10786',
      nextUpdateFieldId: settings.nextUpdateFieldId || 'customfield_10788',
      allowedProjectKey: settings.allowedProjectKey || 'SD',
      fromName: settings.fromName || 'Service Desk'
    }
  });

  return <Form onSubmit={handleSubmit(onSaved)}>
    <FormSection>
      <Label labelFor={getFieldId('clientFieldId')}>Client Jira field ID</Label>
      <Textfield {...register('clientFieldId')} placeholder="customfield_10115" />

      <Label labelFor={getFieldId('issueStartFieldId')}>Issue Start Time field ID</Label>
      <Textfield {...register('issueStartFieldId')} placeholder="customfield_10786" />

      <Label labelFor={getFieldId('nextUpdateFieldId')}>Next Update Due field ID</Label>
      <Textfield {...register('nextUpdateFieldId')} placeholder="customfield_10788" />

      <Label labelFor={getFieldId('allowedProjectKey')}>Allowed project</Label>
      <Textfield {...register('allowedProjectKey')} />

      <Label labelFor={getFieldId('fromName')}>Sender display name</Label>
      <Textfield {...register('fromName')} />
    </FormSection>
    <FormFooter><Button appearance="primary" type="submit">Save settings</Button></FormFooter>
  </Form>;
}

function ContactEditor({ contact, onSaved, onCancel }) {
  const isEdit = Boolean(contact?.id);
  const selectedPriorities = PRIORITY_OPTIONS.filter(o => (contact?.priorities || []).includes(o.value));
  const { handleSubmit, register, getFieldId } = useForm({
    defaultValues: {
      clientCode: contact?.clientCode || '',
      clientName: contact?.clientName || '',
      name: contact?.name || '',
      email: contact?.email || '',
      mobile: contact?.mobile || '',
      priorities: selectedPriorities,
      emailAlerts: contact?.emailAlerts === true,
      smsAlerts: contact?.smsAlerts === true,
      monthlyTestAlerts: contact?.monthlyTestAlerts === true
    }
  });

  const submit = async values => {
    await onSaved({
      ...values,
      id: contact?.id,
      priorities: normalizeSelectedPriorities(values.priorities),
      emailAlerts: values.emailAlerts === true,
      smsAlerts: values.smsAlerts === true,
      monthlyTestAlerts: values.monthlyTestAlerts === true
    });
  };

  return <Form onSubmit={handleSubmit(submit)}>
    <FormSection>
      <Label labelFor={getFieldId('clientCode')}>Client code</Label>
      <Textfield {...register('clientCode', { required: true })} placeholder="RYR" />

      <Label labelFor={getFieldId('clientName')}>Client name</Label>
      <Textfield {...register('clientName')} placeholder="Ryanair" />

      <Label labelFor={getFieldId('name')}>Contact / distribution list name</Label>
      <Textfield {...register('name', { required: true })} />

      <Label labelFor={getFieldId('email')}>Email address</Label>
      <Textfield {...register('email')} type="email" />

      <Label labelFor={getFieldId('mobile')}>Mobile number</Label>
      <Textfield {...register('mobile')} placeholder="+353..." />

      <Label labelFor={getFieldId('priorities')}>Live incident priorities</Label>
      <Select {...register('priorities')} isMulti options={PRIORITY_OPTIONS} />

      <Checkbox {...register('emailAlerts')} label="Receive email alerts" />
      <Checkbox {...register('smsAlerts')} label="Receive SMS alerts" />
      <Checkbox {...register('monthlyTestAlerts')} label="Receive Monthly System Alert Test" />
    </FormSection>
    <FormFooter>
      <ButtonGroup>
        {isEdit && <Button appearance="subtle" onClick={onCancel}>Cancel</Button>}
        <Button appearance="primary" type="submit">{isEdit ? 'Save changes' : 'Add contact'}</Button>
      </ButtonGroup>
    </FormFooter>
  </Form>;
}

const App = () => {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = async () => setData(await invoke('getAdminData'));
  useEffect(() => { load(); }, []);

  if (!data) return <Text>Loading…</Text>;

  const editingContact = editingId ? data.contacts.find(c => c.id === editingId) : null;

  const saveSettings = async values => {
    await invoke('saveSettings', values);
    setMsg('Settings saved.');
    await load();
  };

  const saveContact = async values => {
    await invoke('saveContact', values);
    setMsg(editingId ? 'Contact updated.' : 'Contact saved.');
    setEditingId(null);
    await load();
  };

  const deleteContact = async id => {
    await invoke('deleteContact', { id });
    if (editingId === id) setEditingId(null);
    setMsg('Contact deleted.');
    await load();
  };

  return <Stack space="space.300">
    <Heading size="xlarge">System Alert Contacts</Heading>
    <Text>App version: {data.appVersion || '3.3.0'}</Text>
    <Text>Maintain the client contact directory used by the Send System Alert action. Contact records are stored encrypted in Forge storage.</Text>
    {msg && <SectionMessage appearance="success"><Text>{msg}</Text></SectionMessage>}

    <Box xcss={{ padding: 'space.300', borderColor: 'color.border', borderWidth: 'border.width', borderStyle: 'solid', borderRadius: 'border.radius' }}>
      <Heading size="medium">App settings</Heading>
      <Text>The action is available only on SD tickets with priority P1 or P2. The two date fields below are used to pre-fill the SMS alert.</Text>
      <SettingsForm key={`settings-${JSON.stringify(data.settings)}`} settings={data.settings} onSaved={saveSettings} />
    </Box>

    <Box xcss={{ padding: 'space.300', borderColor: editingContact ? 'color.border.selected' : 'color.border', borderWidth: 'border.width', borderStyle: 'solid', borderRadius: 'border.radius' }}>
      <Heading size="medium">{editingContact ? 'Edit contact' : 'Add contact'}</Heading>
      <Text>{editingContact ? 'Update the saved contact details and alert preferences, then save the changes.' : 'Monthly Test is independent of the incident priority settings, so you can maintain a dedicated test distribution list.'}</Text>
      <ContactEditor key={editingContact?.id || 'new-contact'} contact={editingContact} onSaved={saveContact} onCancel={() => setEditingId(null)} />
    </Box>

    <Heading size="medium">Current contacts</Heading>
    {data.contacts.length === 0 ? <SectionMessage><Text>No contacts have been added yet.</Text></SectionMessage> : data.contacts.map(c =>
      <Box key={c.id} xcss={{ padding: 'space.200', borderBottomColor: 'color.border', borderBottomWidth: 'border.width', borderBottomStyle: 'solid' }}>
        <Stack space="space.050">
          <Heading size="small">{c.clientCode} — {c.name}</Heading>
          <Text>{typeof c.email === 'string' && c.email ? c.email.replace(/(^.).*(@.*$)/, '$1••••$2') : 'No email'} · {c.mobileMasked || 'No mobile'}</Text>
          <Text>{c.priorities.length ? `Live: ${c.priorities.join(', ')}` : 'Live: None'}{c.emailAlerts ? ' · Email' : ''}{c.smsAlerts ? ' · SMS' : ''}{c.monthlyTestAlerts ? ' · Monthly Test' : ''}</Text>
          <ButtonGroup>
            <Button appearance="default" onClick={() => { setEditingId(c.id); setMsg(''); }}>Edit</Button>
            <Button appearance="danger" onClick={() => deleteContact(c.id)}>Delete</Button>
          </ButtonGroup>
        </Stack>
      </Box>
    )}
  </Stack>;
};

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
