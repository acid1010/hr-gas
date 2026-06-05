import dotenv from "dotenv";
import { JWT } from "google-auth-library";

dotenv.config({
  path: "../.env",
});

const authDrive = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL, // ✅ bukan credentials
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

console.log("client email:", process.env.GOOGLE_CLIENT_EMAIL);
console.log("private key:", process.env.GOOGLE_PRIVATE_KEY);
console.log("authDrive:", authDrive.constructor.name); // pastikan authDrive terinisialisasi

console.log("connected to google drive");

export default authDrive;
