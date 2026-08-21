import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';

const SETTINGS_KEY = 'system-alert:settings';
const APP_VERSION = '3.9.7';
const CONFIG_REQUIRED_RESOLVERS = new Set(['getIssueAlertData', 'previewEmail', 'sendAlert']);

function hasConfiguredJiraSettings(settings) {
  return Boolean(
    settings &&
    String(settings.allowedProjectKey || '').trim() &&
    String(settings.clientFieldId || '').trim() &&
    Array.isArray(settings.priorityConfigs) &&
    settings.priorityConfigs.length > 0
  );
}

async function storedSettings() {
  return (await kvs.get(SETTINGS_KEY)) || null;
}

const previousDefine = Resolver.prototype.define;
Resolver.prototype.define = function releaseDefine(key, fn) {
  return previousDefine.call(this, key, async request => {
    if (CONFIG_REQUIRED_RESOLVERS.has(key)) {
      const stored = await storedSettings();
      if (!hasConfiguredJiraSettings(stored)) {
        throw new Error('System Alert Manager is not configured yet. Ask a Jira administrator to complete the Setup guide first.');
      }
    }

    const result = await fn(request);

    if (key === 'getAdminData' && result && typeof result === 'object') {
      const stored = await storedSettings();
      const configured = hasConfiguredJiraSettings(stored);
      const settings = configured
        ? result.settings
        : {
            ...result.settings,
            allowedProjectKey: '',
            clientFieldId: '',
            issueStartFieldId: '',
            nextUpdateFieldId: '',
            priorityConfigs: [],
            optionalFieldMappings: []
          };
      return {
        ...result,
        appVersion: APP_VERSION,
        settings,
        setupStatus: {
          ...result.setupStatus,
          jira: configured,
          clients: configured ? Boolean(result.setupStatus?.clients) : false
        }
      };
    }

    return result;
  });
};

const secure = await import('./secure-index.js');

export const handler = secure.handler;
export const monthlyTestScheduler = secure.monthlyTestScheduler;
