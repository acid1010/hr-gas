const { google } = require("googleapis");
const { NextResponse } = require("next/server");
const { Readable } = require("stream");
const { GoogleAuth } = require("google-auth-library");

export async function POST(req) {
  try {
    const formData = await req.formData();

    return NextResponse.json({ response: "success", status: 200 });
    const file = formData.get("photo");
    const name = formData.get("name");

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const authClient = await auth.getClient(); // 🔥 INI PENTING

    const driveService = google.drive({
      version: "v3",
      auth: authClient,
    });

    const fileStream = Readable.from(buffer);

    const response = await driveService.files.create({
      requestBody: {
        name: name + ".png",
        parents: ["1Sty3bU9Tyqtdj20PIxrdzTHxzan7nVgd"],
      },
      media: {
        body: fileStream,
      },
      supportsAllDrives: true,
    });

    return NextResponse.json({
      success: true,
      fileId: response.data.id,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
