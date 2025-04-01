const AWS = require('aws-sdk');
const express = require('express');
const path = require('path');
require("dotenv").config()
const multer = require('multer');

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'..','views'));

// Configure AWS SDK
AWS.config.update({
    region: process.env.REGION, // Replace with your DynamoDB region
    accessKeyId: process.env.ACCESS_KEY_ID, // Replace with your AWS access key ID
    secretAccessKey: process.env.SECRET_ACCESS_KEY // Replace with your AWS secret access key
});



// Create DynamoDB service object
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const avatar_Default =
  "https://dailocbucket.s3.ap-southeast-1.amazonaws.com/nhucc.jpg";

// Cấu hình Multer để lưu trữ file tạm thời
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 5 * 1024 * 1024 },  
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/; 
        const mimeType = fileTypes.test(file.mimetype);
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimeType && extname) {
            return cb(null, true);
        } else {
            return cb(new Error('File phải là hình ảnh'));
        }
    }
});

// Route to fetch data from DynamoDB
app.get('/', async (req, res) => {
    const params = {
        TableName: 'Paper',
    };

    try {
        const data = await dynamoDB.scan(params).promise();
        const filteredData = data.Items.map((item, index) => ({
            STT: index + 1,
            TenBaiBao: item.TenBaiBao,
            TenNhomTacGia: item.TenNhomTacGia,
            ISBN: item.ISBN,
            SoTrang: item.SoTrang,
            NamXuatBan: item.NamXuatBan,
            ImageURL: item.ImageURL || avatar_Default
        }));

        res.render('index', { data: filteredData });
    } catch (err) {
        console.error('Error fetching data from DynamoDB:', err);
        res.status(500).send('Error fetching data');
    }
});

app.post('/add', upload.single('ImageFile'), async (req, res) => {
    try {
        const { TenBaiBao, TenNhomTacGia, ISBN, SoTrang, NamXuatBan } = req.body;

        let imageUrl = '';

        // Kiểm tra nếu có file ảnh được tải lên
        if (req.file) {
            const file = req.file;
            const fileName = `${file.originalname}`; // Tạo tên file duy nhất
            const s3Params = {
                Bucket: 'dailocbucket', // Tên bucket S3
                Key: fileName,
                Body: file.buffer,  // Sử dụng buffer thay vì file.path
                ContentType: file.mimetype
            };

            // Bọc s3.upload trong Promise
            const uploadResult = await s3.upload(s3Params).promise();
            imageUrl = uploadResult.Location; // Lấy URL của ảnh đã tải lên
        }

        // Lưu bài báo vào DynamoDB
        const params = {
            TableName: 'Paper',
            Item: {
                TenBaiBao,
                TenNhomTacGia,
                ISBN,
                SoTrang: parseInt(SoTrang),
                NamXuatBan: parseInt(NamXuatBan),
                ImageURL: imageUrl // Lưu link ảnh vào DB
            }
        };

        await dynamoDB.put(params).promise();
        res.redirect('/'); // Chuyển hướng về trang chính sau khi thêm thành công
    } catch (err) {
        console.error('Lỗi khi thêm bài báo:', err);
        res.status(500).send('Lỗi khi thêm bài báo.');
    }
});


app.post('/delete', async (req, res) => {
    const { ISBN } = req.body;

    if (!ISBN) {
        return res.status(400).send('ISBN là bắt buộc để xóa bài báo.');
    }

    const params = {
        TableName: 'Paper',
        Key: { ISBN }
    };

    try {
        const { Item } = await dynamoDB.get(params).promise();
        if (Item && Item.ImageURL) {
            const imageKey = Item.ImageURL.split('.amazonaws.com/')[1];

            if (imageKey) {
                await s3.deleteObject({ Bucket: process.env.S3_BUCKET_NAME, Key: imageKey }).promise();
            }
        }

        await dynamoDB.delete(params).promise();
        res.redirect('/'); // Quay lại trang chính sau khi xóa thành công
    } catch (err) {
        console.error('Lỗi khi xóa bài báo:', err);
        res.status(500).send('Lỗi khi xóa bài báo.');
    }
});

app.post('/update', upload.single('ImageFile'), async (req, res) => {
    const { TenBaiBao, TenNhomTacGia, ISBN, SoTrang, NamXuatBan } = req.body;

    if (!ISBN) {
        return res.status(400).send('ISBN là bắt buộc để cập nhật bài báo.');
    }

    let imageUrl = req.body.ImageURL; // Giữ lại URL cũ nếu không có tệp mới

    // Kiểm tra nếu có file ảnh mới được tải lên
    if (req.file) {
        const file = req.file;
        const fileName = `images/${Date.now()}_${file.originalname}`; // Tạo tên file duy nhất
        const s3Params = {
            Bucket: 'dailocbucket', // Tên bucket S3
            Key: fileName,
            Body: file.buffer,  // Sử dụng buffer thay vì file.path
            ContentType: file.mimetype,
            // Bỏ `ACL` vì bạn không cần ACL nếu đã cấu hình bucket với quyền công khai
        };

        try {
            const uploadResult = await s3.upload(s3Params).promise();
            imageUrl = uploadResult.Location; // Cập nhật đường dẫn ảnh mới
        } catch (err) {
            console.error('Lỗi khi tải ảnh lên S3:', err);
            return res.status(500).send('Lỗi khi tải ảnh lên S3.');
        }
    }

    // Cập nhật bài báo vào DynamoDB
    const params = {
        TableName: 'Paper',
        Key: { ISBN },
        UpdateExpression: 'SET TenBaiBao = :title, TenNhomTacGia = :authors, SoTrang = :pages, NamXuatBan = :year, ImageURL = :imageUrl',
        ExpressionAttributeValues: {
            ':title': TenBaiBao,
            ':authors': TenNhomTacGia,
            ':pages': parseInt(SoTrang),
            ':year': parseInt(NamXuatBan),
            ':imageUrl': imageUrl // Cập nhật URL ảnh nếu có
        }
    };

    try {
        await dynamoDB.update(params).promise();
        res.redirect('/'); // Quay lại trang chính sau khi cập nhật thành công
    } catch (err) {
        console.error('Lỗi khi cập nhật bài báo:', err);
        res.status(500).send('Lỗi khi cập nhật bài báo.');
    }
});app.post('/update', upload.single('ImageFile'), async (req, res) => {
    const { TenBaiBao, TenNhomTacGia, ISBN, SoTrang, NamXuatBan } = req.body;

    if (!ISBN) {
        return res.status(400).send('ISBN là bắt buộc để cập nhật bài báo.');
    }

    let imageUrl = req.body.ImageURL; // Giữ lại URL cũ nếu không có tệp mới

    // Kiểm tra nếu có file ảnh mới được tải lên
    if (req.file) {
        const file = req.file;
        const fileName = `${file.originalname}`; // Tạo tên file duy nhất
        const s3Params = {
            Bucket: 'dailocbucket', // Tên bucket S3
            Key: fileName,
            Body: file.buffer,  // Sử dụng buffer thay vì file.path
            ContentType: file.mimetype,
        };

        try {
            const uploadResult = await s3.upload(s3Params).promise();
            imageUrl = uploadResult.Location; // Cập nhật đường dẫn ảnh mới
        } catch (err) {
            console.error('Lỗi khi tải ảnh lên S3:', err);
            return res.status(500).send('Lỗi khi tải ảnh lên S3.');
        }
    }

    // Cập nhật bài báo vào DynamoDB
    const params = {
        TableName: 'Paper',
        Key: { ISBN },
        UpdateExpression: 'SET TenBaiBao = :title, TenNhomTacGia = :authors, SoTrang = :pages, NamXuatBan = :year, ImageURL = :imageUrl',
        ExpressionAttributeValues: {
            ':title': TenBaiBao,
            ':authors': TenNhomTacGia,
            ':pages': parseInt(SoTrang),
            ':year': parseInt(NamXuatBan),
            ':imageUrl': imageUrl // Cập nhật URL ảnh nếu có
        }
    };

    try {
        await dynamoDB.update(params).promise();
        res.redirect('/'); // Quay lại trang chính sau khi cập nhật thành công
    } catch (err) {
        console.error('Lỗi khi cập nhật bài báo:', err);
        res.status(500).send('Lỗi khi cập nhật bài báo.');
    }
});



app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

module.exports = dynamoDB;