const { google } = require("googleapis");

export const uploadToDrive = async (buffer, fileName, tokens) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);

  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: ["1IUHjFDoYkeHzl93Rvi-q7BbS0T_3o_QU"],
      },
      media: {
        mimeType: "application/octet-stream",
        body: Buffer.from(buffer),
      },
    });

    if (!res.data?.id) {
      throw new Error("Upload gagal tanpa file ID");
    }

    return res.data;
  } catch (error) {
    console.error("Upload error:", error.message);
    throw error;
  }
};

export const getDriveLink = (fileId) => {
  return `https://drive.google.com/file/d/${fileId}/view`;
};
