// Local real-service acceptance checks. No production users or ventures are created.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Realtime } from 'ably';

const base = 'http://localhost:8010';
const accounts = JSON.parse(fs.readFileSync('.local/test-accounts.json', 'utf8'));
async function request(path, token, body, expected = 200) {
  const response = await fetch(base + path, {method: body === undefined ? 'GET' : 'POST',
    headers: {Authorization: `Bearer ${token}`, ...(body instanceof FormData ? {} : {'Content-Type': 'application/json'})},
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)});
  assert.equal(response.status, expected, `${path}: ${await response.clone().text()}`);
  return response.json();
}
const tokens = {};
for (const account of accounts) {
  const data = await request('/auth/login', '', {email: account.email, password: account.password});
  tokens[account.roles[0]] = data.token;
  assert.deepEqual((await request('/me', data.token)).roles, account.roles);
}
console.log('PASS login for builder, counterpart, investor and admin');
const workspace = await request('/workspace', tokens.builder);
const pairing = workspace.pairings.find(pair => pair.state === 'proving_run');
assert.ok(pairing);
const auth = await request('/realtime/token', tokens.counterpart, {pairing_id: pairing.id});
assert.deepEqual(Object.values(JSON.parse(auth.token_details.capability)), [['subscribe'], ['subscribe']]);
const ably = new Realtime({tokenDetails: auth.token_details});
try {
  const channel = ably.channels.get(auth.channels[1]);
  let delivered;
  const received = new Promise(resolve => {delivered = resolve;});
  await channel.subscribe('message.created', message => delivered(message.data));
  const id = crypto.randomUUID();
  const message = await request(`/pairings/${pairing.id}/messages`, tokens.builder, {body: 'Live Ably acceptance test', client_id: id}, 201);
  const event = await Promise.race([received, new Promise((_, reject) => setTimeout(() => reject(new Error('Ably delivery timed out')), 45000))]);
  assert.equal(event.message_id, message.id);
  await request(`/pairings/${pairing.id}/messages`, tokens.investor, undefined, 403);
  console.log('PASS durable chat, live Ably pub/sub, investor access denied');
} finally {ably.close();}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=', 'base64');
const form = new FormData(); form.append('file', new Blob([png], {type: 'image/png'}), 'pixel.png');
const asset = await request('/assets', tokens.builder, form, 201);
const response = await fetch(asset.url);
assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp');
console.log('PASS actual MinIO upload, sanitized WebP, public screenshot read');

const scheduled = await request('/admin/email-queue', tokens.admin, {to: 'scheduled@counterpart.test', subject: `Scheduled local check ${Date.now()}`, body: 'Scheduled delivery through Mailpit.', send_at: new Date(Date.now() + 6000).toISOString()}, 201);
assert.equal(scheduled.status, 'scheduled');
await new Promise(resolve => setTimeout(resolve, 14000));
const jobs = await request('/admin/email-queue', tokens.admin);
assert.equal(jobs.find(job => job.id === scheduled.id).status, 'delivered');
const inbox = await (await fetch('http://localhost:8027/api/v1/messages')).json();
assert.ok(inbox.messages.some(message => message.Subject === scheduled.subject));
console.log('PASS scheduled email queue delivered to Mailpit');
