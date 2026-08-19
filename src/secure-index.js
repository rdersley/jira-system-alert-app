import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const ADMIN_RESOLVERS = new Set([
  'getAdminData',
  'saveSettings',
  'saveProviderSettings',
  'startMicrosoftMarketplaceConnection',
  'getMicrosoftMarketplaceSetup',
  'saveMicrosoftMarketplaceSettings',
  'verifyMicrosoftMarketplaceConnection',
  'disconnectMicrosoftMarketplace',
  'verifyMicrosoftEnterpriseConnection',
  'disconnectMicrosoftEnterprise',
  'testEmailProvider',
  'saveTemplates',
  'resetTemplates',
  'saveBranding',
  'resetBranding',
  'previewTemplate',
  'saveContact',
  'testContact',
  'deleteContact'
]);

async function requireJiraAdmin() {
  const response = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('Unable to verify Jira administrator permission.');
  const data = await response.json();
  if (data?.permissions?.ADMINISTER?.havePermission !== true) {
    throw new Error('Jira administrator permission is required for this System Alert Manager action.');
  }
}

const originalDefine = Resolver.prototype.define;
Resolver.prototype.define = function hardenedDefine(key, fn) {
  return originalDefine.call(this, key, async request => {
    if (ADMIN_RESOLVERS.has(key)) await requireJiraAdmin();
    return fn(request);
  });
};

const app = await import('./index.js');

export const handler = app.handler;
