const https = require('http');

function qdrantScroll(filter) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      limit: 10,
      with_payload: true,
      with_vector: false,
      filter: filter
    });
    const req = https.request({
      hostname: '163.245.209.96',
      port: 6333,
      path: '/collections/documents/points/scroll',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Check what we have for requirement_hint 1.2
  const r = await qdrantScroll({
    must: [{ key: 'requirement_hint', match: { value: '1.2' } }]
  });
  const pts = r.result?.points || [];
  console.log('Points for 1.2:', pts.length);
  pts.forEach((p, i) => {
    const pl = p.payload;
    console.log(`\n[${i+1}] source_url: ${pl.source_url}`);
    console.log(`     title: ${pl.title}`);
    console.log(`     text preview: ${(pl.text || pl.pageContent || '').substring(0, 200)}`);
  });
  
  // Also check total docs
  const all = await qdrantScroll({});
  console.log('\nTotal points in collection:', all.result?.points?.length, '(scroll limit 10)');
}
main().catch(console.error);
