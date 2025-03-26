// filepath: t:\OnTapGiuaKy\server.js
const AWS = require('aws-sdk');
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure AWS SDK
AWS.config.update({
    region: 'ap-southeast-1', // Replace with your DynamoDB region
    accessKeyId: '', // Replace with your AWS access key ID
    secretAccessKey: '' // Replace with your AWS secret access key
});

// Create DynamoDB service object
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Route to fetch data from DynamoDB
router.get('/', async(req, res) => {
    const params = {
        TableName: 'Paper', // Replace with your table name
    };

    try {
        const data = await dynamoDB.scan(params).promise(); // Fetch all items from the table
        res.render('index', { data: data.Items }); // Pass data to the EJS template as 'data'
    } catch (err) {
        console.error('Error fetching data from DynamoDB:', err);
        res.status(500).send('Error fetching data');
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

module.exports = dynamoDB;