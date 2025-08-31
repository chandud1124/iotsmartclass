const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot-classroom');
    
    const adminEmail = 'admin@college.edu';
    const newPassword = 'newadmin123'; // Change this to your desired password
    
    const admin = await User.findOneAndUpdate(
      { email: adminEmail },
      { 
        password: newPassword, // Will be hashed by pre-save middleware
        lastProfileUpdate: new Date()
      },
      { new: true }
    );
    
    if (admin) {
      console.log('✅ Admin password updated successfully!');
      console.log('Email:', admin.email);
      console.log('New Password:', newPassword);
      console.log('⚠️  Please remember to change this password after login!');
    } else {
      console.log('❌ Admin not found with email:', adminEmail);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
})();
