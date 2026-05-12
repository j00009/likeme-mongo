const crypto = require('crypto');

const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'likeme-prototype-secret';

const encode = (value) => {
    return Buffer.from(value).toString('base64url');
};

const decode = (value) => {
    return Buffer.from(value, 'base64url').toString('utf8');
};

const signPayload = (payload) => {
    const body = encode(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64url');

    return `${body}.${signature}`;
};

const verifyToken = (token) => {
    if (!token || !token.includes('.')) return null;

    const [body, signature] = token.split('.');
    const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }

    try {
        return JSON.parse(decode(body));
    } catch (error) {
        return null;
    }
};

module.exports = {
    signPayload,
    verifyToken
};
