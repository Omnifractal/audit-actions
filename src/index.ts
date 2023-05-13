import axios from 'axios';
import fs from 'fs';
import * as core from '@actions/core';

const TIMEOUT_MIN = 60;
const TIMEOUT_MAX = 600;

type AuditStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'error';
type Audit = {
  status: AuditStatus;
  message?: string;
  page_name?: string;
  profile_name?: string;
};

function formatSpaces(str: string) {
  return str.split('\n').map((line) => '  ' + line).join('\n');
}

async function checkAuditStatus(auditTrackingIDs: string[]): Promise<{ audits: Audit[] }> {
  const response = await axios.post(
    'https://api.omnifractal.com/v1/checkAuditStatus',
    { audits: auditTrackingIDs },
    { headers: { 'Content-Type': 'application/json' } },
  );

  return response.data;
}

async function runAuditWithActions(config: any): Promise<string[]> {
  const response = await axios.post(
    'https://api.omnifractal.com/v1/auditWithActions',
    config, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    },
  );

  if (response.status >= 400) {
    throw new Error(`${response.status} - ${response.data.message || response.statusText || 'Something went wrong'}`);
  }

  return response.data?.audits ?? [];
}

async function waitForAuditsCompletion(auditTrackingIDs: string[], timeout: number): Promise<{
  finishedAudits: Audit[],
  timeoutOccurred: boolean
}> {
  const startTime = new Date().getTime();
  const endTime = startTime + timeout * 1000;
  let timeoutOccurred = false;

  let finishedAudits: Audit[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (new Date().getTime() >= endTime) {
      timeoutOccurred = true;
      break;
    }

    const auditStatus = await checkAuditStatus(auditTrackingIDs);
    finishedAudits = auditStatus.audits.filter(
      (audit: Audit) => audit.status === 'completed' || audit.status === 'failed' || audit.status === 'error',
    );

    const pendingAudits = auditStatus.audits.filter(
      (audit: Audit) => audit.status !== 'completed' && audit.status !== 'failed' && audit.status !== 'error',
    );

    if (pendingAudits.length === 0) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  return { finishedAudits, timeoutOccurred };
}


function validateTimeout(timeout: number): boolean {
  return timeout >= TIMEOUT_MIN && timeout <= TIMEOUT_MAX;
}

(async function() {
  const pages = core.getInput('pages').split(/[\n\s]+/).map((page) => page.trim());
  const budgetsPath = core.getInput('budgetsPath');
  const budgets = budgetsPath ? JSON.parse(fs.readFileSync(budgetsPath, 'utf8')) : undefined;
  const apiKey = core.getInput('apiKey');
  const branch = core.getInput('branch');
  const repository = core.getInput('repository');
  const waitForResults = core.getInput('waitForResults') === 'true';
  const timeout = parseInt(core.getInput('timeout'), 10);
  if (!validateTimeout(timeout)) {
    core.setFailed('Error: timeout must be between 60 and 600 seconds (1 to 10 minutes)');
    return;
  }

  const commitSha = core.getInput('commit_sha');
  const commitMessage = core.getInput('commit_message');
  const commitAuthor = core.getInput('commit_author');
  const commitAuthorEmail = core.getInput('commit_author_email');

  const auditTrackingIDs = await runAuditWithActions({
    pages,
    budgets,
    branch,
    repository,
    commitSha,
    commitMessage,
    commitAuthor,
    commitAuthorEmail,
    apiKey,
  });

  if (waitForResults) {
    const { finishedAudits, timeoutOccurred } = await waitForAuditsCompletion(auditTrackingIDs, timeout);

    const messageParts: string[] = [];

    finishedAudits.forEach((audit) => {
      const emoji = audit.status === 'completed' ? '✅' : '❌';
      messageParts.push(`- Page: ${audit.page_name} ${emoji}\n  Profile: ${audit.profile_name}\n  Status: ${audit.status}\n`);
      if (audit.message) {
        messageParts.push(`${formatSpaces(audit.message)}\n`);
      }
    });

    if (timeoutOccurred) {
      let message = `Error: ${auditTrackingIDs.length - finishedAudits.length} out of ${auditTrackingIDs.length} audits took too long to complete.`;
      if (finishedAudits.length) {
        message += ` The following audits have finished:\n${messageParts.join('')}`;
      }
      core.setFailed(message);
    } else {
      const message = `Out of ${auditTrackingIDs.length} audits, ${finishedAudits.length} have finished:\n${messageParts.join('')}`;
      if (finishedAudits.some((audit) => audit.status === 'failed' || audit.status === 'error')) {
        core.setFailed(message);
      } else {
        core.debug(message);
      }
    }
  }
})()
  .catch((error: any) => {
    core.setFailed(`Error: ${error.message}`);
    console.error('Error details:', error);
  });
