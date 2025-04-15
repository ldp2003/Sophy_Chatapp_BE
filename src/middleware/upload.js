const multer = require('multer');

const storage = multer.memoryStorage();
const uploadImage = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // giới hạn 10 mb
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true); //null = không có lỗi, true -> chấp nhận
        } else {
            cb(new Error('Only JPG, JPEG, and PNG images are allowed.'), false);
        }
    }
});

const uploadFile = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // giới hạn 100 mb
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/pdf',
            'application/zip',
            'application/x-7z-compressed',
            'text/plain',
            'text/csv',
            'text/html',
            'text/css',
            'text/javascript',
            'text/markdown'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('This file is not supported'), false);
        }
    }
})

module.exports = {uploadImage, uploadFile};