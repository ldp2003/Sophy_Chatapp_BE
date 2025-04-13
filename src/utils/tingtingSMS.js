const axios = require('axios');

class SMSService {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.baseUrl = 'https://api.easysendsms.app/bulksms';
    }

    async sendSMS(phone, message) {
        try {
            // Format phone number: remove leading '0' and add country code
            const formattedPhone = phone.startsWith('0') ? 
                `84${phone.slice(1)}` : phone;

            const params = new URLSearchParams({
                username: this.username,
                password: this.password,
                from: 'Sophy',
                to: formattedPhone,
                text: message,
                type: 0
            });

            const response = await axios.get(`${this.baseUrl}?${params.toString()}`);
            console.log('SMS Request:', {
                phone: formattedPhone,
                response: response.data
            });
            return response.data;
        } catch (error) {
            console.error('SMS Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = SMSService;