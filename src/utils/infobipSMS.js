const https = require('follow-redirects').https;

class InfobipSMS {
    constructor(apiKey, hostname) {
        this.apiKey = apiKey;
        this.hostname = hostname;
        this.options = {
            'method': 'POST',
            'hostname': hostname,
            'path': '/sms/2/text/advanced',
            'headers': {
                'Authorization': `App ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            'maxRedirects': 20
        };
    }

    async sendSMS(phone, message, from) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                "messages": [
                    {
                        "destinations": [
                            { "to": phone.startsWith('0') ? `84${phone.slice(1)}` : phone }
                        ],
                        "from": from,
                        "text": message
                    }
                ]
            });

            const req = https.request(this.options, (res) => {
                const chunks = [];

                res.on("data", (chunk) => chunks.push(chunk));

                res.on("end", () => {
                    const body = Buffer.concat(chunks);
                    console.log('SMS Response:', body.toString());
                    resolve(JSON.parse(body.toString()));
                });

                res.on("error", (error) => {
                    console.error('SMS Error:', error);
                    reject(error);
                });
            });

            req.on('error', (error) => {
                console.error('Request Error:', error);
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }
}

module.exports = InfobipSMS;