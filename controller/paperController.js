const AWS = require('aws-sdk');
const express = require('express');
const path = require('path');
require("dotenv").config()

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
            NamXuatBan: item.NamXuatBan
        }));

        res.render('index', { data: filteredData });
    } catch (err) {
        console.error('Error fetching data from DynamoDB:', err);
        res.status(500).send('Error fetching data');
    }
});

app.post('/add', async (req, res) => {
    const { TenBaiBao, TenNhomTacGia, ISBN, SoTrang, NamXuatBan } = req.body;

    const params = {
        TableName: 'Paper',
        Item: {
            TenBaiBao,
            TenNhomTacGia,
            ISBN,
            SoTrang: parseInt(SoTrang),
            NamXuatBan: parseInt(NamXuatBan)
        }
    };

    try {
        await dynamoDB.put(params).promise();
        res.redirect('/'); // Redirect back to home after adding the entry
    } catch (err) {
        console.error('Error adding data to DynamoDB:', err);
        res.status(500).send('Error adding data');
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
        await dynamoDB.delete(params).promise();
        res.redirect('/'); // Quay lại trang chính sau khi xóa thành công
    } catch (err) {
        console.error('Lỗi khi xóa bài báo:', err);
        res.status(500).send('Lỗi khi xóa bài báo.');
    }
});

app.post('/update', async (req, res) => {
    const { TenBaiBao, TenNhomTacGia, ISBN, SoTrang, NamXuatBan } = req.body;

    if (!ISBN) {
        return res.status(400).send('ISBN là bắt buộc để cập nhật bài báo.');
    }

    const params = {
        TableName: 'Paper',
        Key: { ISBN },
        UpdateExpression: 'SET TenBaiBao = :title, TenNhomTacGia = :authors, SoTrang = :pages, NamXuatBan = :year',
        ExpressionAttributeValues: {
            ':title': TenBaiBao,
            ':authors': TenNhomTacGia,
            ':pages': parseInt(SoTrang),
            ':year': parseInt(NamXuatBan)
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