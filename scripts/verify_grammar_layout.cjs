const http = require('http');

function jsonRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: 9222, path, method }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(data || error.message));
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.webSocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      this.webSocket.onopen = resolve;
      this.webSocket.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    this.webSocket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 8000);
    });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const measureExpression = `(() => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      height: Math.round(box.height),
      display: style.display,
      overflow: style.overflow,
    };
  };
  const nav = rect('.eq-app-bottom-nav');
  const actions = rect('.eq-grammar-learning-actions');
  const submit = rect('.eq-grammar-test-main-button');
  return {
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    scrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    header: rect('.compact-page-header'),
    learnCard: rect('.eq-grammar-learning-card'),
    actions,
    topic: rect('.eq-grammar-test-topic'),
    question: rect('.eq-grammar-test-question'),
    choices: rect('.eq-grammar-test-choices'),
    submit,
    nav,
    actionsGap: actions && nav ? Math.round(nav.top - actions.bottom) : null,
    submitGap: submit && nav ? Math.round(nav.top - submit.bottom) : null,
    buttonVisibleAboveNav: Boolean(
      (actions && nav && actions.bottom <= nav.top) ||
      (submit && nav && submit.bottom <= nav.top)
    ),
    readyState: document.readyState,
    html: document.documentElement.outerHTML.slice(0, 300),
    text: document.body.innerText.slice(0, 240),
  };
})()`;

async function main() {
  console.error('Opening Chrome target');
  let target;
  try {
    target = await jsonRequest('/json/new?about:blank', 'PUT');
  } catch (_error) {
    const targets = await jsonRequest('/json/list');
    target = targets[0];
  }

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready();
  console.error('Connected to target');
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });

  console.error('Opening learning page');
  await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/grammar' });
  await sleep(1800);
  await client.send('Runtime.evaluate', {
    expression: "localStorage.setItem('selected_child_id', '28'); location.href = '/grammar';",
  });
  await sleep(4200);
  const learn = await client.send('Runtime.evaluate', {
    expression: measureExpression,
    returnByValue: true,
  });

  console.error('Opening test page');
  await client.send('Page.navigate', {
    url: 'http://127.0.0.1:5173/grammar-practice?lessonId=G-PREP2-001',
  });
  await sleep(4200);
  const test = await client.send('Runtime.evaluate', {
    expression: measureExpression,
    returnByValue: true,
  });

  console.log(JSON.stringify({ learn: learn.result.value, test: test.result.value }, null, 2));
  client.webSocket.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
