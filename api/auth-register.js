import dbConnect from "../../utils/dbConnect";
import User from "../../utils/models/User";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  await dbConnect();
  if (req.method === "POST") {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Username already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();
    res.status(200).json({ message: "User registered" });
  } else {
    res.status(405).end();
  }
}
