const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// folder defaults to 'nutrisee/meals', pass 'nutrisee/avatars' for profile images
const uploadBase64 = async (base64, folder = 'nutrisee/meals') => {
  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${base64}`,
    {
      folder,
      transformation: [{ width: 800, crop: 'limit', quality: 'auto' }],
    }
  );
  return result.secure_url;
};

module.exports = { uploadBase64 };