import dbConnect from "../../utils/dbConnect";
import Recipe from "../../utils/models/Recipe";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  await dbConnect();
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method === "GET") {
    const recipes = await Recipe.find({ createdBy: userId });
    res.status(200).json(recipes);
  } else if (req.method === "POST") {
    const { title, ingredients, instructions } = req.body;
    const recipe = new Recipe({ title, ingredients, instructions, createdBy: userId });
    await recipe.save();
    res.status(200).json({ message: "Recipe added" });
  } else {
    res.status(405).end();
  }
}
