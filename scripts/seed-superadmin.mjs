import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable in .env.local');
  process.exit(1);
}

const SuperAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'superadmin' },
  isActive: { type: Boolean, default: true },
});

const SuperAdmin = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', SuperAdminSchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const email = 'admin@galla.com';
    const password = 'AdminPassword123!';
    const existing = await SuperAdmin.findOne({ email });

    if (existing) {
      console.log('Super admin already exists.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await SuperAdmin.create({
      name: 'Galla Founder',
      email,
      passwordHash,
      role: 'superadmin',
    });

    console.log('Super admin created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding super admin:', err);
    process.exit(1);
  }
}

seed();
