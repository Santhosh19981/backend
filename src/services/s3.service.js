const AWS = require('aws-sdk');
const crypto = require('crypto');
const path = require('path');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

exports.uploadToS3 = async (file, folder = 'uploads') => {
  const ext = path.extname(file.originalname);
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
  };

  const result = await s3.upload(params).promise();
  return result.Location;
};

exports.deleteFromS3 = async (url) => {
  const key = url.split('.amazonaws.com/')[1];
  await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: key }).promise();
};
