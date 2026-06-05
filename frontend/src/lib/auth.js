const { cookies } = require("next/headers");
const jwt = require("jsonwebtoken");

export default function authToken() {
  const cookieStore = cookies();
  const token = cookieStore.get?.("accessToken");

  if (!token) return null; // Kembalikan null, JANGAN redirect di sini

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}
