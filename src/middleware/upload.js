const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
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

module.exports = upload;