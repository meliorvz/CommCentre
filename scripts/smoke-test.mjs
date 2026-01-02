// Native fetch is used (Node 18+)

const ENVIRONMENTS = [
    { name: 'Development', url: 'https://comms-centre.ancient-fire-eaa9.workers.dev' },
    { name: 'Production', url: 'https://comms-centre-prod.ancient-fire-eaa9.workers.dev' }
];

async function checkHealth(env) {
    try {
        const start = Date.now();
        const res = await fetch(`${env.url}/health`);
        const time = Date.now() - start;

        if (res.ok) {
            const data = await res.json();
            return {
                status: 'Pass ✅',
                details: `${res.status} OK (${time}ms)`,
                data
            };
        } else {
            return {
                status: 'Fail ❌',
                details: `HTTP ${res.status} - ${res.statusText}`
            };
        }
    } catch (err) {
        return {
            status: 'Fail ❌',
            details: `Network Error: ${err.message}`
        };
    }
}

async function run() {
    console.log('\n🔥 Comms Centre Smoke Test 🔥\n');
    console.log('Timestamp:', new Date().toISOString());
    console.log('----------------------------------------');

    for (const env of ENVIRONMENTS) {
        console.log(`Checking ${env.name}...`);
        const result = await checkHealth(env);
        console.log(`Result: ${result.status}`);
        console.log(`Info:   ${result.details}`);
        if (result.data) console.log(`Data:   ${JSON.stringify(result.data)}`);
        console.log('----------------------------------------');
    }
}

run();
