const axios = require('axios');

class SpeedSMS {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.speedsms.vn/index.php';
    }

    async getUserInfo() {
        try {
            const response = await axios({
                method: 'get',
                url: `${this.baseUrl}/user/info`,
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ':x').toString('base64')}`
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get user info: ${error.message}`);
        }
    }

    async sendSMS(phone, message) {
        try {
            const formattedPhone = phone.startsWith('0') ? `84${phone.substring(1)}` : phone;
            
            const data = {
                to: [formattedPhone],
                content: message,
                sms_type: 1,
                sender: 'Notify'
            };

            console.log('Sending request with data:', data);  // Debug log

            const response = await axios({
                method: 'post',
                url: `${this.baseUrl}/sms/send`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ':x').toString('base64')}`
                },
                data: data
            }).catch(error => {
                console.log('Full API Error:', error);  // Log full error
                throw error;
            });

            // Add debug logging
            console.log('API Request:', {
                url: `${this.baseUrl}/sms/send`,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.status === 'success') {
                return {
                    status: 'success',
                    data: response.data
                };
            } else {
                throw new Error(response.data.message || 'Unknown error');
            }
        } catch (error) {
            // Enhanced error logging
            console.error('SMS Error Details:', {
                response: error.response?.data,
                status: error.response?.status,
                error_code: error.response?.data?.code,
                message: error.response?.data?.message || error.message
            });
            
            return {
                status: 'error',
                code: error.response?.data?.code || 'unknown',
                message: error.message,
                invalidPhone: error.response?.data?.invalidPhone || [],
                details: error.response?.data || {}  // Include full error details
            };
        }
    }
}

module.exports = SpeedSMS;