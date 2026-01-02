import http from 'http';
import { URL } from 'url';
import readline from 'readline';
import { exec } from 'child_process';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly'
];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log('\n=== Gmail Refresh Token Generator ===\n');
    console.log('1. Go to Google Cloud Console > APIs & Services > Credentials');
    console.log('2. Open your OAuth 2.0 Client');
    console.log(`3. Ensure "${REDIRECT_URI}" is added to "Authorized redirect URIs"`);
    console.log('   (You can remove it after we are done)\n');

    const clientId = await question('Enter Client ID: ');
    const clientSecret = await question('Enter Client Secret: ');

    if (!clientId || !clientSecret) {
        console.error('Client ID and Secret are required.');
        process.exit(1);
    }

    const server = http.createServer(async (req, res) => {
        try {
            if (req.url.startsWith('/oauth2callback')) {
                const url = new URL(req.url, 'http://localhost:3000');
                const code = url.searchParams.get('code');

                if (code) {
                    res.end('Authentication successful! You can close this window and check the terminal.');
                    console.log('\nAuthorization code received.');

                    // Exchange code for tokens
                    try {
                        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                code,
                                client_id: clientId,
                                client_secret: clientSecret,
                                redirect_uri: REDIRECT_URI,
                                grant_type: 'authorization_code'
                            })
                        });

                        const tokens = await tokenResponse.json();

                        if (tokens.error) {
                            console.error('Error exchanging code:', tokens);
                        } else {
                            console.log('\n✅ SUCCESSS! Here is your Refresh Token for Production:');
                            console.log('\n' + tokens.refresh_token + '\n');
                            console.log('Please save this immediately!');
                            console.log('Run this command to set it:');
                            console.log(`npx wrangler secret put GMAIL_REFRESH_TOKEN --env production`);
                        }
                    } catch (err) {
                        console.error('Failed to fetch tokens:', err);
                    } finally {
                        server.close();
                        rl.close();
                        process.exit(0);
                    }
                } else {
                    res.end('No code found.');
                }
            } else {
                res.end('Not found');
            }
        } catch (e) {
            console.error(e);
            res.end('Error');
        }
    });

    server.listen(3000, () => {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', clientId);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', SCOPES.join(' '));
        authUrl.searchParams.append('access_type', 'offline');
        authUrl.searchParams.append('prompt', 'consent'); // Force refresh token

        console.log('\nOpening browser to authorize...');
        console.log(authUrl.toString());
        exec(`open "${authUrl.toString()}"`);
    });
}

main().catch(console.error);
