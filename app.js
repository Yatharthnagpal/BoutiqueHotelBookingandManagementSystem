require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const multerS3 = require('multer-s3');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname)); // To serve index.html

// AWS config
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const docClient = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const sns = new AWS.SNS();

// 🛏️ Book Room
app.post('/book-room', async (req, res) => {
  const { bookingId, guestName, roomType, checkInDate, checkOutDate, guestEmail, phoneNumber } = req.body;

  const params = {
    TableName: 'Bookings',
    Item: {
      BookingID: bookingId,
      GuestName: guestName,
      RoomType: roomType,
      CheckInDate: checkInDate,
      CheckOutDate: checkOutDate,
    },
  };

  try {
    await docClient.put(params).promise();
    sendEmailConfirmation(guestEmail, bookingId);
    sendSMS(phoneNumber, `Your booking (${bookingId}) is confirmed!`);
    res.status(200).json({ message: 'Booking successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Booking failed' });
  }
});

// 📤 Email Confirmation
const sendEmailConfirmation = (toEmail, bookingId) => {
  const transporter = nodemailer.createTransport({
    SES: new AWS.SES(),
  });

  const mailOptions = {
    from: 'nagpalyatharth99@gmail.com',
    to: 'nagpalyatharth99@gmail.com',
    subject: `Booking Confirmation - ${bookingId}`,
    text: `Thank you for booking. Your booking ID is ${bookingId}.`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error('Email error:', err);
    else console.log('Email sent:', info.response);
  });
};

// 📱 SMS Notification
const sendSMS = (phoneNumber, message) => {
  sns.publish(
    { Message: message, PhoneNumber: phoneNumber },
    (err, data) => {
      if (err) console.error('SMS error:', err);
      else console.log('SMS sent:', data);
    }
  );
};

// 🖼️ Image Upload
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'boutiquehotelroomimages', // Your S3 bucket
    acl: 'public-read',
    key: (req, file, cb) => {
      cb(null, `rooms/${Date.now()}-${file.originalname}`);
    },
  }),
});

app.post('/upload-room-image', upload.single('roomImage'), (req, res) => {
  res.status(200).json({ imageUrl: req.file.location });
});

// Start server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
