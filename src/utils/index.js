export const formatMessage = (username, text) => {
    return {
        username,
        text,
        time: new Date().toISOString()
    };
};

export const validateInput = (input) => {
    return input && input.trim().length > 0;
};